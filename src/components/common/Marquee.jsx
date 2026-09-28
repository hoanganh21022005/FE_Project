import React from 'react';

export function Marquee({ items, speed = '40s' }) {
  // Tạo danh sách các phần tử kèm dấu chấm ngăn cách
  const content = items.map((item, index) => (
    <span key={index} className="mx-4 font-black uppercase text-[15px] sm:text-[17px] tracking-wider flex items-center shrink-0">
      {item}
      <span className="mx-4 opacity-50 text-[10px]">•</span>
    </span>
  ));

  return (
    <div className="w-full bg-sc-primary text-white overflow-hidden py-3">
      {/* Container trượt, sẽ di chuyển sang trái 50% độ dài của nó */}
      <div 
        className="flex w-max"
        style={{ animation: `marquee ${speed} linear infinite` }}
      >
        {/* Khối 1 */}
        <div className="flex shrink-0 px-2">{content}</div>
        {/* Khối 2 (bản sao của khối 1 để nối đuôi) */}
        <div className="flex shrink-0 px-2" aria-hidden="true">{content}</div>
      </div>
    </div>
  );
}
