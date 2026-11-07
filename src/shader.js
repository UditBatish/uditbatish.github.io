export const vert = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Silk wave through an ordered pixel dither. One canvas pixel = one dither cell;
// CSS scales it up with image-rendering: pixelated.
// One photo at a time takes over a side of the field, and the whole
// field dissolves into white above the headline.
export const frag = `
precision highp float;

uniform vec2  u_res;       // canvas size in cells
uniform float u_time;
uniform vec2  u_mouse;
uniform float u_intro;
uniform vec3  u_pal[5];
uniform vec2  u_fade;      // fade start/end, as fraction of height from the top
uniform vec3  u_paper;     // page colour the field dissolves into
uniform float u_lift;      // palette value the field drifts toward as it fades (1 = cream, 0 = navy)

uniform sampler2D u_img;
uniform vec4  u_slot;      // centre xy, size wh (uv units)
uniform vec3  u_info;      // presence, image aspect, side
uniform float u_focus;     // horizontal point of the photo to keep when its sides are cropped

// ---------- noise (Ashima simplex 3D) ----------
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

vec3 pal(float x) {
  x = clamp(x, 0.0, 1.0) * 4.0;
  vec3 c = mix(u_pal[0], u_pal[1], clamp(x, 0.0, 1.0));
  c = mix(c, u_pal[2], clamp(x - 1.0, 0.0, 1.0));
  c = mix(c, u_pal[3], clamp(x - 2.0, 0.0, 1.0));
  c = mix(c, u_pal[4], clamp(x - 3.0, 0.0, 1.0));
  return c;
}

float silk(vec2 p, float t) {
  vec2 q = p;
  q += 0.16 * vec2(fbm(vec3(p * 0.55, t * 0.045)), fbm(vec3(p * 0.55 + 4.3, t * 0.045)));
  float w = q.y * 1.3 - q.x * 0.5 + 0.6 * sin(q.x * 1.4 + t * 0.10) + 0.2 * sin(q.x * 2.7 - t * 0.07 + 1.3);
  float ridge = pow(0.5 + 0.5 * cos(w * 3.2 - t * 0.11), 3.0);
  float sweep = smoothstep(-1.2, 1.2, p.x * 0.8 - p.y * 0.5 + 0.18 * fbm(vec3(p * 0.4, t * 0.03)));
  return clamp(sweep * 0.42 + ridge * (0.22 + 0.6 * sweep), 0.0, 1.0);
}

// Photo filling one side of the field. Its inner edge follows the silk value, so the
// ribbons appear to turn into the photo; presence slides that edge in and out.
// info.z: -1 = left side, 1 = right side, 0 = phones (enters from the top),
// 2 = full bleed (fills the whole field, grows from the centre, blends at both sides).
vec2 photo(vec4 slot, vec3 info, vec2 p, float silkV, float t) {
  vec2 lp = (p - slot.xy) / slot.zw;                 // -0.5..0.5 inside the slot
  float warp = (silkV - 0.5) * 0.32 + 0.06 * snoise(vec3(p * 2.2, t * 0.07));
  float m;
  if (info.z > 1.5) {
    float u = 1.0 - 2.0 * abs(lp.x);                 // 0 at either side, 1 in the centre
    m = smoothstep(0.0, 0.3, u + warp - (1.0 - info.x) * 1.3);
  } else {
    float u = info.z == 0.0 ? lp.y + 0.5 : lp.x * info.z + 0.5;   // 0 at the inner edge, 1 at the outer
    m = smoothstep(0.0, 0.22, u + warp - (1.0 - info.x) * 1.25);
  }
  m *= step(0.001, info.x);
  m *= step(abs(lp.x), 0.5) * step(abs(lp.y), 0.5);
  // cover-fit, keeping the top of the photo (the bottom melts into the white)
  float ra = slot.z / slot.w;
  vec2 tuv = lp * (1.0 - 0.05 * info.x);
  if (info.y > ra) { float k = ra / info.y; tuv.x = tuv.x * k + clamp(u_focus - 0.5, 0.5 * k - 0.5, 0.5 - 0.5 * k); }
  else { float k = info.y / ra; tuv.y = tuv.y * k + (0.5 - 0.5 * k) * (info.z > 1.5 ? 0.95 : 0.4); }
  tuv = vec2(tuv.x + 0.5, 0.5 - tuv.y);
  vec3 c = texture2D(u_img, tuv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  l = 0.06 + 0.92 * l;                               // photos arrive pre-levelled
  return vec2(l, m);
}

void main() {
  float t = u_time;
  vec2 cid = floor(gl_FragCoord.xy);
  vec2 p = (cid + 0.5 - 0.5 * u_res) / u_res.y;
  float yTop = 1.0 - (cid.y + 0.5) / u_res.y;

  float v = silk(p, t);
  float md = length(p - u_mouse);
  v += 0.2 * exp(-md * md * 8.0);

  // the photo builds in cell by cell in an ordered pattern, so it develops rather than speckles
  vec2 a = photo(u_slot, u_info, p, v, t);
  v = mix(v, a.x, step(mix(bayer8(cid + 3.0), hash(cid * 1.73 + 3.1), 0.25), a.y));

  // fade toward white: values lift first, then cells drop out
  float wob = 0.025 * sin(p.x * 3.0 + t * 0.12) + 0.02 * snoise(vec3(p * 2.0, t * 0.05));
  float f = smoothstep(u_fade.x, u_fade.y, yTop + wob);
  v = mix(v, u_lift, f * 0.85);

  float th = mix(bayer8(cid), hash(cid), 0.2);
  float q = floor(v * 6.0 + th) / 6.0;
  vec3 col = pal(q);

  float keep = 1.0 - f;
  float order = hash(cid * 1.31) * 0.6 + yTop * 0.4;   // intro: cells pop in top-down
  keep *= step(order, u_intro * 1.05);
  col = mix(u_paper, col, step(hash(cid * 0.77 + 11.0), keep));

  gl_FragColor = vec4(col, 1.0);
}
`;
