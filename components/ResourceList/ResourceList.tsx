"use client";

import type { Resource } from "@/types/game";

interface ResourceListProps {
  resources: Resource[];
}

export default function ResourceList({ resources }: ResourceListProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Resources</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map((r) => (
          <div
            key={r.id}
            className="border rounded p-4 shadow-sm bg-white"
          >
            <h3 className="font-bold">{r.name}</h3>
            <p className="text-sm text-gray-600">{r.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
