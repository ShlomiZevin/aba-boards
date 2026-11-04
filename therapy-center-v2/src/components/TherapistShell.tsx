import { useQuery } from '@tanstack/react-query';
import { useTherapist } from '../contexts/TherapistContext';
import { practitionersApi, notificationsApi } from '../api/client';
import NbNav, { type NavItem, type QuickAction } from '../v2/NbNav';

interface TherapistShellProps {
  children: React.ReactNode;
}

export default function TherapistShell({ children }: TherapistShellProps) {
  const { practitionerId } = useTherapist();
  const prefix = `/t/${practitionerId}`;

  const { data: practitionerInfoRes } = useQuery({
    queryKey: ['practitioner-info', practitionerId],
    queryFn: () => practitionersApi.getInfo(practitionerId!),
    enabled: !!practitionerId,
  });
  const practitioner = practitionerInfoRes?.data;

  const { data: myNotificationsRes } = useQuery({
    queryKey: ['notifications', 'mine'],
    queryFn: () => notificationsApi.getMine(),
    refetchInterval: 60_000,
  });
  const unreadCount = (myNotificationsRes?.data || []).filter(n => !n.read).length;

  const primary: NavItem[] = [
    { path: '/', label: 'היום', icon: 'today', exact: true },
    { path: '/kids', label: 'ילדים', icon: 'kids' },
    { path: '/notifications', label: 'הודעות', icon: 'bell', badge: unreadCount || undefined },
    { path: '/chat', label: 'צ׳אט AI', icon: 'sparkle' },
  ];
  const more: NavItem[] = [
    { path: '/forms', label: 'טפסים', icon: 'form' },
    { path: '/docs', label: 'מסמכים', icon: 'book' },
    { path: '/models', label: 'מודלים לבנייה', icon: 'blocks' },
    { path: '/install-app', label: 'התקנת אפליקציה', icon: 'phone' },
  ];
  const quick: QuickAction[] = [
    { key: 'form', label: 'טופס טיפול', hint: 'מילוי אחרי מפגש', icon: 'form', tone: 'yellow', needsKid: true, to: id => `/form/new?kidId=${id}` },
    { key: 'daily', label: 'דיווח יומי', hint: 'טוב · בסדר · קשה', icon: 'report', tone: 'mint', needsKid: true, to: id => `/kid/${id}/daily-reports` },
    { key: 'agenda', label: 'סדר יום', hint: 'מה עושים היום', icon: 'agenda', tone: 'sky', needsKid: true, to: id => `/kid/${id}/agenda` },
    { key: 'msg', label: 'הודעות', hint: 'מה חדש', icon: 'chat', tone: 'pink', needsKid: false, to: () => '/notifications' },
  ];

  return (
    <NbNav
      prefix={prefix}
      primary={primary}
      more={more}
      quick={quick}
      userName={practitioner?.name || ''}
      userRole={practitioner?.type || 'מטפל/ת'}
    >
      {children}
    </NbNav>
  );
}
