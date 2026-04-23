'use client';

export default function TypingBubble() {
  return (
    <div className="flex items-end gap-2 mb-1">
      <div className="rounded-2xl rounded-bl-md bg-white border border-gray-100 px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="h-[6px] w-[6px] rounded-full bg-gray-400 animate-[typingDot_1.4s_ease-in-out_infinite]" />
          <span className="h-[6px] w-[6px] rounded-full bg-gray-400 animate-[typingDot_1.4s_ease-in-out_0.2s_infinite]" />
          <span className="h-[6px] w-[6px] rounded-full bg-gray-400 animate-[typingDot_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
      </div>
    </div>
  );
}
