export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="panel max-w-md p-6 text-center">
        <h1 className="text-3xl font-bold mb-2">404</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          The page you are looking for does not exist.
        </p>
      </section>
    </main>
  );
}
