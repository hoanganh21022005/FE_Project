import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { StatusBadge } from '../common/Badge';
import { AttendanceCorrectionModal } from '../modals/AttendanceCorrectionModal';
import { ClipboardCheck, Edit2 } from 'lucide-react';

export function CoachAttendanceView() {
  const { classes, members, attendance, recordAttendance, t, language } = useSCMS();
  const selectedClass = classes[0];

  const [selectedMemberModal, setSelectedMemberModal] = useState(null);

  const enrolledMembers = members.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Class Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            BUỔI HỌC HIỆN TẠI
          </span>
          <h2 className="text-base font-bold text-slate-900 mt-1">{selectedClass?.nameVi}</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            {selectedClass?.date} &bull; {selectedClass?.startTime} &bull; Phòng: {selectedClass?.room} &bull; Coach: {selectedClass?.coachName}
          </p>
        </div>

        <div className="p-3 bg-slate-50 rounded border border-slate-200 text-right">
          <div className="text-[10px] text-slate-500 uppercase font-bold whitespace-nowrap">
            {language === 'vi' ? 'Sức chứa' : 'Enrolled Capacity'}
          </div>
          <div className="text-lg font-bold text-slate-900 tabular-nums whitespace-nowrap">
            {selectedClass?.enrolledCount}/{selectedClass?.capacity} {language === 'vi' ? 'Học viên' : 'Members'}
          </div>
        </div>
      </div>

      {/* Attendance Roster */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-slate-700 shrink-0" />
            <span className="whitespace-nowrap">{language === 'vi' ? 'Danh Sách Học Viên Điểm Danh' : 'Attendance Roster'}</span>
          </h3>
          <span className="text-xs text-amber-800 font-semibold">
            {language === 'vi'
              ? 'Thao tác sửa sẽ bắt buộc nhập lý do & ghi Audit Log'
              : 'Edits require mandatory reason input & Audit Log recording'}
          </span>
        </div>

        <div className="space-y-3">
          {enrolledMembers.map(m => {
            const att = attendance.find(a => a.classId === selectedClass?.id && a.memberId === m.id);
            const currentStatus = att ? att.status : 'not_recorded';

            return (
              <div key={m.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">{m.name}</div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">{m.code} &bull; Gói: {m.currentPackageName}</div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge type="attendance" status={currentStatus} />

                  {/* Rapid Attendance Buttons */}
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-300">
                    <button
                      onClick={() => recordAttendance(selectedClass.id, m.id, 'present')}
                      className={`px-2.5 py-1 text-xs font-bold rounded ${currentStatus === 'present' ? 'bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      Có mặt
                    </button>
                    <button
                      onClick={() => recordAttendance(selectedClass.id, m.id, 'late')}
                      className={`px-2.5 py-1 text-xs font-bold rounded ${currentStatus === 'late' ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      Trễ
                    </button>
                    <button
                      onClick={() => recordAttendance(selectedClass.id, m.id, 'absent')}
                      className={`px-2.5 py-1 text-xs font-bold rounded ${currentStatus === 'absent' ? 'bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      Vắng
                    </button>
                  </div>

                  {/* Edit with reason modal */}
                  <button
                    onClick={() => setSelectedMemberModal({ memberId: m.id, memberName: m.name, status: currentStatus })}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 text-xs shadow-2xs"
                    title="Chỉnh sửa &amp; nhập lý do"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedMemberModal && (
        <AttendanceCorrectionModal
          classId={selectedClass?.id || ''}
          memberId={selectedMemberModal.memberId}
          memberName={selectedMemberModal.memberName}
          currentStatus={selectedMemberModal.status}
          isOpen={!!selectedMemberModal}
          onClose={() => setSelectedMemberModal(null)}
        />
      )}
    </div>
  );
}
