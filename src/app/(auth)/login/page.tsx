import { AuthForm } from "../auth-form";
import { safeNext } from "@/lib/safe-next";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return <AuthForm mode="login" next={safeNext(next)} />;
}
