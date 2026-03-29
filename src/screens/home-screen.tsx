import { CreateEventScreen } from "./create-event-screen.js";
import { EventDetailRouteScreen } from "./event-detail-screen.js";

type HomeScreenProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function HomeScreen({ searchParams }: HomeScreenProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const eventId = getEventIdFromSearchParams(resolvedSearchParams);

  if (eventId) {
    return <EventDetailRouteScreen eventId={eventId} />;
  }

  return <CreateEventScreen />;
}

function getEventIdFromSearchParams(searchParams: Record<string, string | string[] | undefined>): string | null {
  for (const [key, value] of Object.entries(searchParams)) {
    if (key.trim().length === 0) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0 || value.every((item) => item === "")) {
        return key;
      }
      continue;
    }

    if (value === "" || typeof value === "undefined") {
      return key;
    }
  }

  return null;
}
