import { AuthForm } from "../auth-form";
import { safeNext } from "@/lib/safe-next";

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const { next } = await searchParams;
  return <AuthForm mode="signup" next={safeNext(next)} />;
}
