import { Megaphone } from "lucide-react";
import type { AnnouncementOut } from "../../lib/types";

export function AnnouncementBanner({
  announcement,
  isAdmin,
  onManage,
}: {
  announcement: AnnouncementOut;
  isAdmin: boolean;
  onManage: () => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-[auto_1fr_auto] items-start gap-[13px] rounded-[11px] border-l-[3px] border-brand-600 bg-white p-[11px_13px]">
      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-brand-600 text-white">
        <Megaphone size={16} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-extrabold text-brand-600">ADMIN ANNOUNCEMENT</span>
          <time className="text-[8px] text-[#98949f]">
            Posted {new Date(announcement.created_at).toLocaleDateString()}
          </time>
        </div>
        <strong className="mt-0.5 block text-[11px] font-bold text-ink">{announcement.title}</strong>
        <p className="mt-0.5 text-[10px] text-[#615d69]">{announcement.body}</p>
      </div>
      {isAdmin && (
        <button
          onClick={onManage}
          className="whitespace-nowrap rounded-lg border border-[#c8c6f5] bg-white px-[11px] py-1.5 text-[10px] font-bold text-brand-600 hover:bg-brand-50"
        >
          Manage announcement
        </button>
      )}
    </div>
  );
}
