import { ArticleFeed } from "./components/ArticleFeed";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-amber-50">
      <section className="mx-auto min-h-screen w-full max-w-md px-5 py-8">
        <header className="mb-8">
          <p className="mb-2 text-sm font-medium text-amber-400">
            Peaceful stories from around the world
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-amber-100">
            HappyNews
          </h1>

          <p className="mt-3 text-base leading-7 text-neutral-300">
            A calm daily feed of uplifting, inspiring, and human stories.
          </p>
        </header>

        <ArticleFeed />
      </section>
    </main>
  );
}