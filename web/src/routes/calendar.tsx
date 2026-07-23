import { createFileRoute } from '@tanstack/react-router';
import { CalendarScreen } from '@/components/calendar/CalendarScreen';

export const Route = createFileRoute('/calendar')({ component: CalendarScreen });
