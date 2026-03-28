import { EventDetailScreen } from "../../../src/components/event-detail-screen.js";

interface EventPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventPage({ params }: EventPageProps) {
  const { eventId } = await params;
  return <EventDetailScreen eventId={eventId} />;
}

