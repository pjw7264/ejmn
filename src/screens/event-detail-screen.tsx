import { EventDetailScreen as EventDetailView } from "../components/event-detail-screen.js";

type EventDetailRouteScreenProps = {
  eventId: string;
};

export function EventDetailRouteScreen({ eventId }: EventDetailRouteScreenProps) {
  return <EventDetailView eventId={eventId} />;
}
