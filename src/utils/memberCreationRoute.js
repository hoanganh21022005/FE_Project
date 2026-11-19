export function selectMemberCreateRoute(authorities) {
  const list = Array.isArray(authorities)
    ? authorities.map((item) => String(item || "").trim().toUpperCase())
    : []
  if (list.includes("MANAGE_USERS")) return "create"
  if (list.includes("REGISTER_MEMBER")) return "register"
  return "create"
}
