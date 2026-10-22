// Media is local and replaceable. Video URLs remain null until approved clips are supplied.
export const SPORT_MEDIA = {
  tennis: { poster: '/images/courses/tennis.jpg', webm: null, mp4: null, gradient: 'from-emerald-950' },
  swimming: { poster: '/images/courses/swimming.jpg', webm: null, mp4: null, gradient: 'from-cyan-950' },
  pickleball: { poster: '/images/courses/pickleball.jpg', webm: null, mp4: null, gradient: 'from-lime-950' },
  archery: { poster: '/images/courses/archery.jpg', webm: null, mp4: null, gradient: 'from-amber-950' },
  basketball: { poster: '/images/courses/basketball.jpg', webm: null, mp4: null, gradient: 'from-orange-950' },
  football: { poster: '/images/courses/football.jpg', webm: null, mp4: null, gradient: 'from-green-950' },
  volleyball: { poster: '/images/courses/volleyball.jpg', webm: null, mp4: null, gradient: 'from-yellow-950' },
  badminton: { poster: '/images/courses/badminton.jpg', webm: null, mp4: null, gradient: 'from-teal-950' },
  'table-tennis': { poster: '/images/courses/table-tennis-room.jpg', webm: null, mp4: null, gradient: 'from-rose-950' },
};

export const COURSE_HERO_MEDIA = {
  poster: '/images/courses/tennis.jpg',
  webm: null,
  mp4: null,
};

export const recommendSports = ({ goal, fitness, budget }) => {
  if (goal === 'competition') return ['tennis', 'swimming'];
  if (goal === 'weight' || fitness === 'active') return ['football', 'basketball'];
  if (budget === 'low') return ['table-tennis', 'badminton'];
  if (goal === 'health') return ['swimming', 'badminton'];
  return ['pickleball', 'volleyball'];
};
