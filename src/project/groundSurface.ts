import * as THREE from 'three';

const DEFAULT_ATLAS_LUMINANCE = [0.124672, 0.155343, 0.437175, 0.475114];

export type GroundSurfaceSettings = {
  version?: number;
  src: string;
  strength?: number;
  atlasLuminance?: number[];
};

/** Metre-scale surface detail, independent of the city image's resolution. */
export function addGroundSurfaceDetail(
  material: THREE.MeshStandardMaterial,
  base: THREE.Texture,
  atlas: THREE.Texture,
  settings: GroundSurfaceSettings,
  renderer: THREE.WebGLRenderer,
) {
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = renderer.capabilities.getMaxAnisotropy();
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.needsUpdate = true;
  const image = base.image as { width?: number; height?: number } | undefined;
  const width = Number(image?.width) || 8192;
  const height = Number(image?.height) || 7552;
  const strength = THREE.MathUtils.clamp(settings.strength ?? 0.85, 0, 1);

  material.customProgramCacheKey = () => 'ground-surface-v1';
  material.onBeforeCompile = shader => {
    shader.uniforms.groundAtlas = { value: atlas };
    shader.uniforms.groundBaseTexel = { value: new THREE.Vector2(1 / width, 1 / height) };
    shader.uniforms.groundDetailStrength = { value: strength };
    shader.uniforms.groundAtlasLuminance = { value: new THREE.Vector4().fromArray(settings.atlasLuminance ?? DEFAULT_ATLAS_LUMINANCE) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundPosition;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGroundPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', /* glsl */ `
      #include <common>
      varying vec3 vGroundPosition;
      uniform sampler2D groundAtlas;
      uniform vec2 groundBaseTexel;
      uniform float groundDetailStrength;
      uniform vec4 groundAtlasLuminance;

      float groundLuma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
      float groundHash( vec2 p ) {
        vec3 q = fract( vec3( p.xyx ) * 0.1031 );
        q += dot( q, q.yzx + 33.33 );
        return fract( ( q.x + q.y ) * q.z );
      }
      float groundNoise( vec2 p ) {
        vec2 i = floor( p ), f = fract( p );
        f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( groundHash( i ), groundHash( i + vec2( 1.0, 0.0 ) ), f.x ),
          mix( groundHash( i + vec2( 0.0, 1.0 ) ), groundHash( i + 1.0 ), f.x ), f.y );
      }
      vec3 groundTile( vec2 p, vec2 quadrant ) {
        // Mirrored repeats keep sampling inside one quadrant, including seams.
        vec2 uv = 1.0 - abs( mod( p, 2.0 ) - 1.0 );
        return texture2D( groundAtlas, quadrant + ( 0.002 + uv * 0.996 ) * 0.5 ).rgb;
      }
      vec3 groundBumpNormal( vec3 eyePosition, vec3 n, float height ) {
        vec3 dx = dFdx( eyePosition ), dy = dFdy( eyePosition );
        vec3 r1 = cross( dy, n ), r2 = cross( n, dx );
        float determinant = dot( dx, r1 );
        vec3 gradient = dFdx( height ) * r1 + dFdy( height ) * r2;
        return normalize( abs( determinant ) * n - sign( determinant ) * gradient );
      }
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', /* glsl */ `
      #include <map_fragment>
      float groundPixelSize = max( length( dFdx( vGroundPosition.xz ) ), length( dFdy( vGroundPosition.xz ) ) );
      float groundFade = 1.0 - smoothstep( 0.10, 0.65, groundPixelSize );
      float groundStrength = groundFade * groundDetailStrength;
      vec3 groundBase = diffuseColor.rgb;
      #ifdef USE_MAP
        // Restore local contrast without changing any image coordinates.
        vec2 groundStep = groundBaseTexel * 2.2;
        vec3 groundNeighbours = (
          texture2D( map, vMapUv + vec2( groundStep.x, 0.0 ) ).rgb +
          texture2D( map, vMapUv - vec2( groundStep.x, 0.0 ) ).rgb +
          texture2D( map, vMapUv + vec2( 0.0, groundStep.y ) ).rgb +
          texture2D( map, vMapUv - vec2( 0.0, groundStep.y ) ).rgb ) * 0.25;
        groundBase = clamp( groundBase + ( groundBase - groundNeighbours * diffuse ) * 0.32 * groundStrength, 0.0, 1.0 );
      #endif
      float groundBrightness = groundLuma( groundBase );
      float groundGreen = smoothstep( 0.66, 0.95, groundBase.g / max( groundBase.r, 0.006 ) )
        * smoothstep( 1.30, 1.70, groundBase.g / max( groundBase.b, 0.006 ) )
        * ( 1.0 - smoothstep( 0.40, 0.66, groundBrightness ) );
      float groundWater = smoothstep( 0.78, 1.02, groundBase.b / max( groundBase.g, 0.006 ) )
        * smoothstep( 1.15, 1.6, groundBase.b / max( groundBase.r, 0.006 ) )
        * ( 1.0 - smoothstep( 0.12, 0.28, groundBrightness ) );
      groundGreen *= 1.0 - groundWater;
      float groundGreenAA = max( fwidth( groundGreen ), 0.008 );
      groundGreen = smoothstep( 0.38 - groundGreenAA, 0.38 + groundGreenAA, groundGreen );
      float groundHard = ( 1.0 - groundGreen ) * ( 1.0 - groundWater );
      float groundWarmth = smoothstep( 0.025, 0.075, ( groundBase.r + groundBase.g ) * 0.5 - groundBase.b );
      float groundBrightnessAA = max( fwidth( groundBrightness ), 0.004 );
      float groundBright = smoothstep( 0.39 - groundBrightnessAA, 0.39 + groundBrightnessAA, groundBrightness );
      float groundPaving = groundHard * groundBright * groundWarmth;
      float groundPaint = groundHard * groundBright * ( 1.0 - groundWarmth );
      float groundAsphalt = groundHard - groundPaving;
      vec2 groundXZ = vGroundPosition.xz;

      // The aerial image contains painted canopy/shadow blobs. At close range,
      // reconstruct the actual surface colour instead of enlarging those blobs.
      float groundNaturalVariation = 0.94 + 0.12 * groundNoise( groundXZ / 7.0 );
      vec3 groundLawnColour = vec3( 0.10, 0.18, 0.044 ) * groundNaturalVariation;
      vec3 groundPavingColour = mix( vec3( 0.60, 0.585, 0.535 ), groundBase,
        smoothstep( 0.70, 0.90, groundBrightness ) );
      vec3 groundSurfaceColour = groundGreen * groundLawnColour
        + groundPaving * groundPavingColour
        + groundAsphalt * mix( vec3( 0.23, 0.24, 0.235 ), vec3( 0.67, 0.67, 0.64 ), groundPaint ) + groundWater * groundBase;
      groundBase = mix( groundBase, groundSurfaceColour, groundStrength * 0.96 );

      vec3 groundAsphaltTile = groundTile( groundXZ / 4.0, vec2( 0.0, 0.5 ) );
      vec3 groundGrassTile = groundTile( groundXZ / 3.0, vec2( 0.5, 0.5 ) );
      vec3 groundStoneTile = groundTile( groundXZ / 2.4, vec2( 0.5, 0.0 ) );
      vec3 groundConcreteTile = groundTile( groundXZ / 3.6, vec2( 0.0, 0.0 ) );
      float groundGrain =
        groundAsphalt * clamp( groundLuma( groundAsphaltTile ) / groundAtlasLuminance.x, 0.65, 1.45 ) +
        groundGreen * clamp( groundLuma( groundGrassTile ) / groundAtlasLuminance.y, 0.45, 1.65 ) +
        groundPaving * clamp( groundLuma( mix( groundConcreteTile, groundStoneTile, 0.65 ) ) / mix( groundAtlasLuminance.z, groundAtlasLuminance.w, 0.65 ), 0.78, 1.22 ) + groundWater;

      // Physical paving sizes: 60 x 90 cm with 7 mm recessed joints.
      vec2 groundSlab = groundXZ / vec2( 0.60, 0.90 );
      groundSlab.x += mod( floor( groundSlab.y ), 2.0 ) * 0.5;
      vec2 groundCellEdge = min( fract( groundSlab ), 1.0 - fract( groundSlab ) ) * vec2( 0.60, 0.90 );
      float groundEdgeDistance = min( groundCellEdge.x, groundCellEdge.y );
      float groundJointAA = max( fwidth( groundEdgeDistance ), 0.001 );
      float groundJoint = ( 1.0 - smoothstep( 0.0035, 0.0035 + groundJointAA, groundEdgeDistance ) )
        * ( 1.0 - smoothstep( 0.025, 0.12, groundPixelSize ) );
      float groundSlabVariation = mix( 0.96, 1.04, groundHash( floor( groundSlab ) ) );
      vec3 groundDetailed = groundBase * mix( 1.0, groundGrain, 0.78 );
      groundDetailed *= 1.0 - groundPaving * groundJoint * 0.36;
      groundDetailed *= mix( 1.0, groundSlabVariation, groundPaving );
      diffuseColor.rgb = mix( groundBase, groundDetailed, groundStrength );
      float groundSurfaceHeight = groundStrength * (
        groundGreen * ( groundLuma( groundGrassTile ) - groundAtlasLuminance.y ) * 0.045 +
        groundAsphalt * ( groundNoise( groundXZ * 110.0 ) - 0.5 ) * 0.0012 -
        groundPaving * groundJoint * 0.004 );
    `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix( roughnessFactor, 0.94 - groundPaving * 0.10, groundStrength * ( 1.0 - groundWater ) );`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = groundBumpNormal( -vViewPosition, normal, groundSurfaceHeight );`);
  };
  material.needsUpdate = true;
}
