import { createFileRoute } from '@tanstack/react-router';
import { WhatToWatchScreen } from '@/components/discover/WhatToWatchScreen';

export const Route = createFileRoute('/discover/what-to-watch')({ component: WhatToWatchScreen });
