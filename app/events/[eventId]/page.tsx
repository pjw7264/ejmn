import { redirect } from "next/navigation.js";

interface EventPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventPage({ params }: EventPageProps) {
  const { eventId } = await params;
  redirect(`/?${encodeURIComponent(eventId)}`);
}
