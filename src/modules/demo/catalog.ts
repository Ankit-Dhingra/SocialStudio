export const demoReels = [
  { id: 'whatsapp-v2', title: 'How WhatsApp delivers messages after a week offline', category: 'Messaging',
    description: 'Trace what happens when a phone reconnects and receives its queued messages.', durationSeconds: 148.416, featured: true },
  { id: 'load-balancing', title: 'How load balancing distributes requests', category: 'Infrastructure',
    description: 'Follow incoming requests as they are routed across backend servers.', durationSeconds: 18.219, featured: false },
  { id: 'bloom-filter', title: 'How a Bloom filter answers membership queries', category: 'Data structures',
    description: 'See how a bit array can rule out membership and why positive results can be wrong.', durationSeconds: 31.637, featured: false },
  { id: 'merkle-tree', title: 'How a Merkle tree pinpoints differences', category: 'Distributed systems',
    description: 'Follow hash comparisons down a tree to find which data needs repair.', durationSeconds: 42.944, featured: false },
  { id: 'rag', title: 'How retrieval helps answer questions from a PDF', category: 'Applied AI',
    description: 'Trace the path from document chunks and embeddings to relevant passages and an answer.', durationSeconds: 135.680, featured: false },
] as const;

export type DemoReelId = typeof demoReels[number]['id'];
