import { Link } from 'react-router';

/**
 * A link from a user/doctor/appointment record to its filtered audit-log
 * entries — see the `audit-log` spec's "Audit page in the web app": "The
 * admin pages for users, doctors, and appointments SHALL link to the audit
 * entries for the record being viewed."
 */
export function AdminAuditLink({ entityType, entityId }: { entityType: string; entityId: string }) {
  return (
    <Link
      to={`/admin/audit?entityType=${entityType}&entityId=${entityId}`}
      className="text-xs text-primary underline-offset-4 hover:underline"
    >
      View audit history
    </Link>
  );
}
