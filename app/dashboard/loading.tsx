import React from "react";

export default function DashboardLoading() {
  return (
    <div className="flex-1 h-full min-h-[50vh] flex flex-col items-center justify-center bg-[#f6f1e5]">
      <div className="size-10 rounded-full border-3 border-[#800080]/20 border-t-[#800080] animate-spin" />
      <p className="mt-4 text-xs font-semibold tracking-wide text-neutral-500 font-sans">
        Loading workspace...
      </p>
    </div>
  );
}
