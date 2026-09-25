export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-forest text-3xl font-semibold">Trailmix</h1>
        <p className="text-foreground/70 mt-1">Plan hikes together.</p>
      </div>
      {children}
    </main>
  );
}
