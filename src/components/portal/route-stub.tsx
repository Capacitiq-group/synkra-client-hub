export function RouteStub({ title, prompt }: { title: string; prompt: string }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
        {/* Placeholder route — real content arrives in a later prompt. */}
        Built in Portal Prompt {prompt}.
      </p>
    </div>
  );
}
