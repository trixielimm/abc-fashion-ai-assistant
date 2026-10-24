// Prepare distinct, catalogue-grounded image requests for the 150-image batch.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('output/imagegen/missing-product-images-priority-150-2026-10-19-catalogue.json');
const target = resolve('output/imagegen/modelled-priority-150-prompts.json');
const products = JSON.parse(readFileSync(source, 'utf8')).products;
if (products.length !== 150) throw new Error(`Expected 150 products, got ${products.length}`);

const backgrounds = 'light grey seamless studio backdrop';
const ethnicities = ['Black African', 'East Asian', 'South Asian', 'Latina', 'Middle Eastern', 'Southeast Asian', 'White European', 'Pacific Islander', 'Indigenous Australian', 'mixed-race', 'North African', 'West Asian', 'Afro-Caribbean', 'Central Asian', 'Mediterranean'];
const hair = ['short natural curls', 'a neat dark bob', 'long wavy hair', 'a close-cropped haircut', 'braided hair', 'a swept-back ponytail', 'shoulder-length curls', 'a textured pixie cut', 'loose dark waves', 'a silver buzz cut', 'a high bun', 'a curly fringe', 'straight chestnut hair', 'a cropped coily style', 'a soft grey bob'];
const builds = ['athletic', 'petite', 'tall and lean', 'curvy', 'broad-shouldered', 'average', 'full-figured', 'slender', 'stocky', 'muscular'];
const skin = ['deep brown', 'warm brown', 'olive', 'medium tan', 'fair', 'light brown', 'rich umber', 'golden tan', 'porcelain', 'copper'];
const face = ['defined cheekbones', 'a round face', 'a strong jawline', 'freckles', 'a soft oval face', 'prominent brows', 'a long face', 'a square face', 'a heart-shaped face', 'a broad smile'];
const gaze = ['looking slightly left', 'looking slightly right', 'looking straight ahead', 'looking down at the product', 'looking just past the camera'];

const poses = {
  Clothing: [
    'walking forward with one foot crossing slightly in front', 'standing with weight on the back foot and one hand in a pocket',
    'turning gently over one shoulder', 'sitting upright on a simple stool with the garment unobscured',
    'taking a side step with arms relaxed', 'standing with arms loosely crossed below the product detail',
    'pausing mid-stride with shoulders angled', 'pivoting toward the camera with one heel raised',
    'leaning lightly against an invisible studio wall', 'standing tall with hands loosely at the sides',
    'stepping diagonally toward the lens', 'turning from profile toward a three-quarter view',
    'sitting at the edge of a stool with one knee extended', 'walking past the camera while glancing back',
    'standing with one foot forward and elbows relaxed', 'taking a measured step with one arm swinging naturally',
    'standing in a gentle contrapposto with open shoulders', 'making a small half-turn with fabric moving naturally',
    'standing with fingertips resting on the hip', 'walking with a slight diagonal cross-step'
  ],
  Shoes: [
    'seated with both feet extended toward the lens', 'taking a mid-stride step with both shoes visible',
    'sitting on a low stool with one foot angled outward', 'standing with one foot slightly ahead of the other',
    'crouching lightly with hands away from the shoes', 'stepping up onto a low neutral platform',
    'standing on tiptoe with heels and shoe shape visible', 'seated side-on with ankles uncrossed',
    'walking diagonally across the frame', 'standing with toes turned slightly outward',
    'sitting on a high stool with both shoes hanging visibly', 'taking a small step backward while shoes stay clear'
  ],
  Bags: [
    'holding the bag by its handle beside the hip', 'carrying the bag over one shoulder with the front unobscured',
    'walking while holding the bag at thigh height', 'sitting with the bag placed visibly on the lap',
    'turning three-quarter while the bag hangs from the forearm', 'standing with the bag held slightly forward',
    'carrying the bag crossbody with its full front visible', 'resting the bag against one open palm at waist height',
    'stepping forward with the bag hanging naturally', 'holding the bag at the side with the arm extended slightly',
    'standing in profile with the bag turned toward camera', 'seated with the bag on a nearby plain stool'
  ],
  Accessories: [
    'touching the accessory lightly while keeping it unobscured', 'turning the head so the accessory faces the camera',
    'standing with one hand near the face and the accessory fully visible', 'looking down with the accessory presented toward camera',
    'holding the accessory beside the body without covering it', 'walking slowly while the accessory remains visible',
    'sitting upright with the accessory facing the lens', 'raising one arm gently to show the accessory',
    'standing in profile with the accessory toward camera', 'pivoting gently to reveal the accessory',
    'resting a hand near the collar while leaving the accessory clear', 'holding the accessory at chest height with fingers clear of its details'
  ]
};

const framingFor = product => {
  if (product.category === 'Shoes') return 'lower-body or seated framing that clearly shows both shoes';
  if (product.category === 'Bags') return 'three-quarter or full-body framing with the full bag visible';
  if (product.subcategory === 'Jewellery') return 'close-up of the worn jewellery and relevant face, neck or hands';
  if (product.category === 'Accessories') return 'half-body or close-up framing that clearly shows the accessory';
  return 'full-body or three-quarter framing with the complete garment visible';
};

const manifest = products.map((product, index) => {
  const gender = product.gender === 'Men' ? 'man' : product.gender === 'Women' ? 'woman' : index % 3 === 0 ? 'nonbinary adult' : index % 3 === 1 ? 'man' : 'woman';
  const age = 22 + ((index * 11) % 43);
  const model = `${age}-year-old ${ethnicities[index % ethnicities.length]} ${gender} with ${skin[(index * 3) % skin.length]} skin, ${hair[(index * 7) % hair.length]}, a ${builds[(index * 7) % builds.length]} build and ${face[(index * 9) % face.length]}`;
  const categoryPoses = poses[product.category] || poses.Accessories;
  const basePose = categoryPoses[Math.floor(index / 3) % categoryPoses.length];
  const pose = `${basePose}, ${gaze[index % gaze.length]}, with ${index % 2 ? 'the left' : 'the right'} shoulder a little nearer the camera, ${index % 3 === 0 ? 'a relaxed open hand' : index % 3 === 1 ? 'a gently bent elbow' : 'a natural arm swing'}, and ${['the chin level', 'the chin slightly lifted', 'the chin slightly lowered'][Math.floor(index / 60)]}`;
  const azimuth = -32 + (index % 65);
  const elevation = 3 + Math.floor(index / 65) * 6;
  const camera = `${Math.abs(azimuth)} degrees to the ${azimuth < 0 ? 'model’s left' : 'model’s right'} at ${elevation} degrees above level`;
  const title = `${product.category} – ${product.product_name} – ${model} – ${pose}`;
  const material = product.subcategory === 'Hats' && product.material?.includes('Metal')
    ? 'conventional fabric (the catalogue material field conflicts with the product type)'
    : product.material || 'unspecified';
  const prompt = [
    'Use case: product-mockup.',
    `Create exactly ONE professional photorealistic e-commerce image for product ${product.product_id}: ${product.product_name}.`,
    `Catalogue attributes: ${product.gender} ${product.product_type || product.subcategory}; ${product.colour} colour; ${material} material; ${product.fit || 'standard'} fit; ${product.style || 'contemporary'} style; ${product.occasion || 'everyday'} occasion.`,
    `Model: a unique adult ${model}. Never use a generic repeated face.`,
    `Pose: ${pose}. Camera: ${camera}.`,
    `Present the product worn or naturally used, clearly and fully visible, as the hero. ${framingFor(product)}.`,
    `Scene: ${backgrounds}; soft natural studio light, restrained neutral styling appropriate to ${product.category.toLowerCase()} and ${product.occasion?.toLowerCase() || 'daily'} wear.`,
    'Vertical 4:5 composition, realistic high-resolution sharp focus, true-to-life colour and natural skin texture.',
    'The catalogue has no reference photo for this product, so use only conventional details supported by its metadata. No invented logos, prints, elaborate hardware, text or brand marks.',
    'Avoid distorted hands or fingers, extra limbs, obscured product, warped details, watermarks, heavy filters, plastic-looking skin, and multiple products or people.'
  ].join(' ');
  return { priority: index + 1, product_id: product.product_id, image_key: product.image_key, title, model, pose, camera, prompt, output_file: `output/imagegen/modelled-priority-150/${product.product_id}.png` };
});

Object.assign(manifest[0], {
  model: 'Black woman in her early 30s with a short natural afro and athletic build',
  pose: 'confident mid-stride with one hand relaxed at her side',
  camera: 'three-quarter eye-level view',
  title: 'Clothing – Yellow Co-ord Set – Black woman in her early 30s with a short natural afro – confident mid-stride',
  prompt: 'Use case: product-mockup. Create one photorealistic professional e-commerce image for P1320 Yellow Co-ord Set. A dark-skinned Black woman in her early 30s with a short natural afro and athletic build wears a minimalist formal yellow cotton co-ord set with a regular fit, simple top and tailored trousers. Full outfit clearly visible, true yellow cotton texture, conventional minimal tailoring. Confident mid-stride, one hand relaxed at her side, three-quarter eye-level camera angle. Light grey seamless studio backdrop, soft natural light, vertical 4:5 composition. No invented logo, print or embellishment, text or watermark.'
});

const referencedCardigan = manifest.find(item => item.product_id === 'P1258');
if (!referencedCardigan) throw new Error('P1258 is not in the batch');
Object.assign(referencedCardigan, {
  model: 'adult East Asian woman, approximately 155 cm tall, with shoulder-length dark brown hair, clear-framed glasses and a warm smile, based on four user-provided photos',
  pose: 'relaxed three-quarter stance with one foot slightly forward, one hand touching the cardigan hem and baggy black trousers visible',
  camera: 'eye-level, slightly from her right',
  reference_images: 4,
  title: 'Clothing – Red Cardigan – 155 cm East Asian woman with dark hair and clear-framed glasses – relaxed stance with baggy black pants',
  prompt: 'Use case: product-mockup. Create one photorealistic e-commerce image for P1258 Red Cardigan. Preserve the identity of the same adult woman in four user-provided reference photos: East Asian facial features, clear-framed glasses, shoulder-length dark brown hair and warm smile. Depict realistic petite proportions for a 155 cm tall model. Make the simple slim-fit red knit cardigan fully visible as the product hero, with loose baggy black trousers and neutral shoes. Full-body vertical 4:5 studio image, relaxed three-quarter stance, one foot forward, one hand lightly touching the hem. Light grey backdrop, soft natural studio light. Do not import the reference backgrounds, other people or text. Avoid invented logos, distorted anatomy, watermarks and heavy filters.'
});

const sandals = manifest.find(item => item.product_id === 'P1180');
if (!sandals) throw new Error('P1180 is not in the batch');
Object.assign(sandals, {
  model: '35-year-old Latina woman with shoulder-length curls and a full-figured build',
  pose: 'small diagonal step with both platform sandals visible',
  camera: 'eye-level full-body view slightly from her left',
  title: 'Shoes – Black Platform Sandals – 35-year-old Latina woman with shoulder-length curls – small diagonal step showing both sandals',
  prompt: 'Use case: product-mockup. Create one photorealistic professional e-commerce image for P1180 Black Leather Platform Sandals. A fully clothed 35-year-old Latina adult woman with shoulder-length curls and a full-figured build stands in a clean light grey studio. She wears an opaque long-sleeve cream blouse and full-length neutral trousers with hems above the ankles. Small diagonal step with both black platform sandals clearly visible; their soles, straps and shape are the product hero. Full-body vertical 4:5 catalogue photograph, soft natural studio lighting, realistic skin texture and true black colour. Simple conventional leather construction, no invented logos, swimwear, suggestive styling, text or watermarks.'
});

if (new Set(manifest.map(x => x.model)).size !== 150 || new Set(manifest.map(x => x.pose)).size !== 150 || new Set(manifest.map(x => x.camera)).size !== 150) {
  throw new Error('Model, pose, or camera descriptions are not unique');
}
writeFileSync(target, JSON.stringify({ generated_at: new Date().toISOString(), background: backgrounds, aspect_ratio: '4:5', products: manifest }, null, 2) + '\n');
console.log(JSON.stringify({ output: target, count: manifest.length, first: manifest[0].product_id, last: manifest.at(-1).product_id }));
