import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector4,
  WebGLRenderTarget,
} from 'three';
import type { WebGLRenderer } from 'three';
import type { ViewPipeline } from 'quilt-three';

/** Proof of per-view effects; intentionally not a built-in Quilt effect or composer adapter. */
export function grayscale(renderer: WebGLRenderer): ViewPipeline {
  const target = new WebGLRenderTarget(1, 1);
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: { image: { value: target.texture } },
    vertexShader:
      'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader:
      'uniform sampler2D image; varying vec2 vUv; void main() { vec4 c = texture2D(image, vUv); float gray = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); gl_FragColor = vec4(vec3(gray), c.a);\n#include <colorspace_fragment>\n}',
  });
  const output = new Scene();
  output.add(new Mesh(geometry, material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    resize(width, height, dpr) {
      target.setSize(Math.max(1, Math.round(width * dpr)), Math.max(1, Math.round(height * dpr)));
    },
    render(frame) {
      const viewport = renderer.getViewport(new Vector4()),
        scissor = renderer.getScissor(new Vector4());
      const scissorTest = renderer.getScissorTest();
      const previous = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(target);
        renderer.setScissorTest(false);
        renderer.clear();
        renderer.render(frame.scene, frame.camera);
        renderer.setRenderTarget(previous);
        renderer.setViewport(viewport);
        renderer.setScissor(scissor);
        renderer.setScissorTest(scissorTest);
        renderer.render(output, camera);
      } finally {
        renderer.setRenderTarget(previous);
        renderer.setViewport(viewport);
        renderer.setScissor(scissor);
        renderer.setScissorTest(scissorTest);
      }
    },
    dispose() {
      target.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
