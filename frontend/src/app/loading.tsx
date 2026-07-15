import { Container } from "@/components/layout/Container";
import { LoadingCards } from "@/components/ui/LoadingCards";

export default function Loading() { return <Container className="py-12"><p className="mb-5 text-sm text-slate-400">Loading anime...</p><LoadingCards /></Container>; }
