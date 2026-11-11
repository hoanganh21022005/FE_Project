import React from "react"
import { Link } from "react-router-dom"
import { ArrowRight, MapPin, Users } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { publicCourses } from "../../data/publicCourses"
import "../../styles/facilities.css"

const roomKeywordsBySport = {
  badminton: ["cau long"],
  "table-tennis": ["bong ban"],
  pickleball: ["pickleball"],
  basketball: ["bong ro"],
  volleyball: ["bong chuyen"],
  archery: ["ban cung"],
  swimming: ["boi loi", "ho boi"],
  football: ["bong da"],
  tennis: ["tennis", "quan vot"],
}

const normalizeSearchText = (value = "") =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replaceAll(String.fromCharCode(273), "d")
    .replaceAll(String.fromCharCode(272), "d")
    .toLocaleLowerCase("vi")

export function FacilitiesExperience() {
  const { language, rooms = [] } = useSCMS()
  const isVi = language === "vi"
  const facilityRooms = Array.isArray(rooms) ? rooms : []
  const totalRoomCapacity = facilityRooms.reduce((total, room) => total + (Number(room.capacity) || 0), 0)
  const getCourseRooms = (course) => {
    const keywords = roomKeywordsBySport[course.id] || []
    return facilityRooms.filter((room) => {
      const roomText = normalizeSearchText(`${room.name || ""} ${room.nameVi || ""}`)
      return keywords.some((keyword) => roomText.includes(keyword))
    })
  }

  return (
    <section id="facilities" className="facility-experience" aria-labelledby="facilities-title">
      <div className="facility-hero" style={{ "--facility-hero-image": "url('/images/training-spaces/swimming.jpg')" }}>
        <div className="facility-hero-grid" aria-hidden="true" />
        <div className="facility-hero-content">
          <span className="facility-kicker">VIBE SPORT · FACILITIES</span>
          <h1 id="facilities-title">{isVi ? <>CƠ SỞ<br /><span>VẬT CHẤT</span></> : <>OUR<br /><span>FACILITIES</span></>}</h1>
          <p>{isVi
            ? "Không gian tập luyện đa dạng, được bố trí theo từng bộ môn để bạn rèn luyện kỹ năng và tiến bộ qua mỗi buổi tập."
            : "Purposeful training spaces for every sport, helping you build skills and progress with every session."}</p>
        </div>
      </div>

      <div className="facility-stat-band">
        <div className="facility-stat">
          <span className="facility-stat-icon" aria-hidden="true">01</span>
          <div><strong>{publicCourses.length}</strong><span>{isVi ? "BỘ MÔN THỂ THAO" : "SPORTS"}</span></div>
        </div>
        <div className="facility-stat">
          <MapPin className="facility-stat-lucide" aria-hidden="true" />
          <div><strong>{facilityRooms.length}</strong><span>{isVi ? "PHÒNG / KHU TẬP" : "TRAINING AREAS"}</span></div>
        </div>
        <div className="facility-stat">
          <Users className="facility-stat-lucide" aria-hidden="true" />
          <div><strong>{totalRoomCapacity}</strong><span>{isVi ? "TỔNG SỨC CHỨA PHÒNG" : "TOTAL ROOM CAPACITY"}</span></div>
        </div>
      </div>

      <div className="facility-details">
        <div className="facility-details-heading">
          <div>
            <p className="facility-section-kicker">{isVi ? "KHÔNG GIAN THEO BỘ MÔN" : "SPACES BY SPORT"}</p>
          </div>
        </div>

        <div className="facility-detail-list">
          {publicCourses.map((course, index) => {
            const courseRooms = getCourseRooms(course)
            const locations = [...new Set(courseRooms.map((room) => room.location).filter(Boolean))]
            const capacity = courseRooms.reduce((sum, room) => sum + (Number(room.capacity) || 0), 0)
            const courseTitle = isVi ? course.title : course.titleEn
            return (
              <article key={course.id} className={"facility-detail-card " + (index % 2 ? "facility-detail-card-reverse" : "")}>
                <div className="facility-detail-image-wrap">
                  <img
                    src={course.spaceImage}
                    alt={isVi ? "Không gian tập luyện " + courseTitle : courseTitle + " training space"}
                    loading={index < 2 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <span className="facility-detail-number">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="facility-detail-copy">
                  <h3>{courseTitle}</h3>
                  <p className="facility-detail-description">{isVi ? course.space : course.spaceEn}</p>
                  <div className="facility-detail-facts">
                    <div className="facility-detail-fact">
                      <MapPin aria-hidden="true" />
                      <div>
                        <span>{isVi ? "KHU VỰC" : "LOCATION"}</span>
                        <strong>{locations.length ? locations.join(" · ") : (isVi ? "Theo lịch lớp học" : "Assigned by class schedule")}</strong>
                      </div>
                    </div>
                    {courseRooms.length > 0 && (
                      <div className="facility-detail-fact">
                        <Users aria-hidden="true" />
                        <div>
                          <span>{isVi ? "SỨC CHỨA PHÒNG LIÊN QUAN" : "CAPACITY OF MATCHING ROOMS"}</span>
                          <strong>{capacity} {isVi ? "chỗ" : "places"} · {courseRooms.length} {isVi ? "phòng/khu" : "room(s)"}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                  {courseRooms.length > 0 && (
                    <div className="facility-room-tags">
                      {courseRooms.map((room) => (
                        <span key={room.id}>{room.name + (room.capacity ? " · " + room.capacity + " " + (isVi ? "chỗ" : "places") : "")}</span>
                      ))}
                    </div>
                  )}
                  <Link to={"/courses/" + course.id} className="facility-detail-link">
                    {isVi ? "Xem khóa học" : "Explore course"}<ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
