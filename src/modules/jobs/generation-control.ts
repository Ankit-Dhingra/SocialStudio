import mongoose, { Schema } from 'mongoose';

const controls = mongoose.model('GenerationControl', new Schema({
  _id: String,
  paused: { type: Boolean, required: true },
  updatedBy: String,
}, { collection: 'generation_controls', timestamps: true }));

export const generationPaused = async () => Boolean(await controls.exists({ _id: 'hosted', paused: true }));

export async function setGenerationPaused(paused: boolean, updatedBy: string) {
  await controls.updateOne({ _id: 'hosted' }, { $set: { paused, updatedBy } }, { upsert: true });
}
