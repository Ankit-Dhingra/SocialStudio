import 'dotenv/config';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseCustomScriptToStoryboard } from '../src/modules/ai-script/custom-script-parser.js';
import { renderStillPreviews } from '../src/modules/render/video-renderer.js';
import { prepareReelVisuals } from '../src/modules/render/reel-visual-assets.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';

const creatorScript = {
  title: "How Zomato Surge Pricing Works During Rain",
  hook: "रात के 12 बजे, तेज़ बारिश हो रही है। Zomato पर delivery charge ₹30 से अचानक ₹90 हो गया। Restaurant वही, घर वही, distance भी वही। फिर ये extra ₹60 कहाँ से आ गए?",
  problem: "मान लो उस area में 100 orders आ गए, लेकिन बारिश की वजह से सिर्फ 20 riders available हैं। अब हर order पर पूरी city के riders को search करना expensive होगा। और सिर्फ distance देखकर charge तय करेंगे, तो असली demand और rider shortage का पता ही नहीं चलेगा।",
  solution: "इस problem को solve करने के लिए एक possible design है Location-Based Dynamic Pricing। इसमें पूरे शहर की जगह छोटे geographical areas की demand और available riders को track करते हैं। फिर एक Pricing Engine इन्हीं local conditions के हिसाब से delivery charge calculate करता है।",
  tech_explained: "अब समझो backend में ये कैसे काम कर सकता है। हर rider की app GPS location और availability status भेजती है। System इन locations को छोटे geographical cells में map करता है। इसके लिए H3 Spatial Indexing जैसी technique इस्तेमाल हो सकती है। अब हर cell में कितने orders pending हैं और कितने riders actually available हैं, उसका count maintain किया जाता है। ये counts Redis जैसे fast cache में रख सकते हैं। मान लो तुम्हारे area में 100 orders और सिर्फ 20 available riders हैं। यानी हर rider पर average 5 orders की demand है। Pricing Engine इस imbalance के साथ बारिश, estimated delivery time और configured pricing rules को evaluate करता है। Example के लिए base delivery fee ₹30 है, और इन conditions में ₹60 additional charge calculate हुआ। तो app तुम्हें ₹90 दिखाएगी। लेकिन एक catch है। अगर rider offline हो गया और उसकी पुरानी GPS location cache में बची है, तो system उसे available समझ सकता है। इसलिए recent heartbeat, timestamp और active delivery status verify करना ज़रूरी है।",
  conclusion: "तो ₹30 से ₹90 होने की वजह distance बढ़ना ज़रूरी नहीं है। असली factor हो सकता है local demand, rider availability और delivery conditions का बदलना। यही Dynamic Pricing का core idea है। Price सिर्फ distance से नहीं, current supply-demand conditions से भी प्रभावित हो सकता है।",
  cta: "ऐसी ही interesting tech stories के पीछे की engineering समझने के लिए Behind The Tech को अभी follow करो।"
};

async function main() {
  const [scriptPath, outputPath = 'output/cinematic-previews'] = process.argv.slice(2);
  const input = scriptPath ? await readFile(scriptPath, 'utf8') : creatorScript;
  const storyboard = await parseCustomScriptToStoryboard(input);
  const timeline = buildVideoTimeline(storyboard);
  const visuals = await prepareReelVisuals(storyboard, timeline);
  const stills = await renderStillPreviews(storyboard, timeline, path.resolve(outputPath), '/previews', visuals.shots);
  for (const still of stills) console.log(`Frame ${still.frame}: ${still.filePath}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
