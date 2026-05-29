'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="panel max-w-md p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
