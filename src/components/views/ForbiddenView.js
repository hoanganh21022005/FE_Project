import React from "react";
import { ShieldAlert, ArrowLeft, RefreshCw } from "lucide-react";

export function ForbiddenView({
  currentRole = "",
  requiredRole = "",
  allowedRoles = [],
  attemptedPath = "",
  message = "",
  onGoHome = null,
}) {
  const rolesNeeded =
    allowedRoles.length > 0 ? allowedRoles.join(", ") : requiredRole;

  return React.createElement(
    "div",
    { className: "w-full flex items-center justify-center py-12 px-4" },
    React.createElement(
      "div",
      {
        id: "forbidden-view",
        className:
          "max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center",
      },
      React.createElement(
        "div",
        {
          className:
            "w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5 text-amber-600",
        },
        React.createElement(ShieldAlert, { className: "w-8 h-8" }),
      ),
      React.createElement(
        "div",
        {
          className:
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100/60 text-amber-800 mb-3",
        },
        React.createElement("span", null, "HTTP 403"),
        React.createElement("span", null, "•"),
        React.createElement("span", null, "Truy cập bị từ chối"),
      ),
      React.createElement(
        "h1",
        { className: "text-2xl font-bold text-slate-900 tracking-tight mb-2" },
        "Không có quyền truy cập",
      ),
      React.createElement(
        "p",
        { className: "text-sm text-slate-600 mb-6 leading-relaxed" },
        message ||
          "Tài khoản của bạn không có đủ thẩm quyền để xem trang hoặc thực hiện hành động này. Phiên đăng nhập của bạn vẫn được giữ nguyên an toàn.",
      ),
      (attemptedPath || rolesNeeded || currentRole) &&
        React.createElement(
          "div",
          {
            className:
              "bg-slate-50 rounded-xl p-4 mb-6 text-left text-xs text-slate-600 space-y-1.5 border border-slate-100",
          },
          attemptedPath &&
            React.createElement(
              "div",
              null,
              React.createElement(
                "span",
                { className: "font-semibold text-slate-700" },
                "Đường dẫn yêu cầu: ",
              ),
              React.createElement(
                "code",
                {
                  className:
                    "text-slate-800 bg-slate-200/70 px-1 py-0.5 rounded font-mono",
                },
                attemptedPath,
              ),
            ),
          rolesNeeded &&
            React.createElement(
              "div",
              null,
              React.createElement(
                "span",
                { className: "font-semibold text-slate-700" },
                "Vai trò yêu cầu: ",
              ),
              React.createElement(
                "span",
                { className: "font-medium text-amber-700 capitalize" },
                rolesNeeded,
              ),
            ),
          currentRole &&
            React.createElement(
              "div",
              null,
              React.createElement(
                "span",
                { className: "font-semibold text-slate-700" },
                "Vai trò hiện tại: ",
              ),
              React.createElement(
                "span",
                { className: "font-medium text-slate-800 capitalize" },
                currentRole,
              ),
            ),
        ),
      React.createElement(
        "div",
        {
          className:
            "flex flex-col sm:flex-row items-center justify-center gap-3",
        },
        onGoHome &&
          React.createElement(
            "button",
            {
              id: "forbidden-go-home",
              type: "button",
              onClick: onGoHome,
              className:
                "w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#BA0000] hover:bg-[#8E0000] text-white font-medium text-sm transition-colors shadow-xs",
            },
            React.createElement(ArrowLeft, { className: "w-4 h-4" }),
            React.createElement("span", null, "Về Bảng điều khiển của bạn"),
          ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () =>
              typeof window !== "undefined" && window.location.reload(),
            className:
              "w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors",
          },
          React.createElement(RefreshCw, { className: "w-4 h-4" }),
          React.createElement("span", null, "Tải lại"),
        ),
      ),
    ),
  );
}
