# VIBE Sport hero video

`vibe-sport-montage-1080p.mp4` combines nine 3-second scenes into one 27-second loop.
Encoding: 1920×1080, 30 fps, H.264 High / yuv420p, no audio, MP4 fast start.
`vibe-sport-poster.jpg` is a frame from the montage, shown while the video loads.
`../images/swimming-course.jpg` is a frame from the swimming scene, used for the swimming course on the homepage.

## Stock footage credits

Footage downloaded from Pexels under the [Pexels License](https://www.pexels.com/license/), except the table tennis scene, which is from Mixkit under the [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree).
These scenes are illustrative stock footage, not footage of VIBE Sport facilities.

| Montage time | Sport | Creator and source | Source start |
| --- | --- | --- | --- |
| 00–03 s | Cầu lông | [SHVETS production — Women Playing Badminton](https://www.pexels.com/video/women-playing-badminton-8053493/) | 1 s |
| 03–06 s | Bóng bàn | [Mixkit — Ping Pong Paddle Striking Ball in Mid-Game Action](https://mixkit.co/free-stock-video/ping-pong-paddle-striking-ball-in-mid-game-action-101288/) | 0.5 s |
| 06–09 s | Pickleball | [Pexels — Aerial View of Outdoor Pickleball Matches](https://www.pexels.com/video/aerial-view-of-outdoor-pickleball-matches-37165624/) | 1 s |
| 09–12 s | Bóng rổ | [RDNE Stock project — Man Playing Basketball](https://www.pexels.com/video/man-playing-basketball-8337077/) | 2 s |
| 12–15 s | Bóng chuyền | [Pavel Danilyuk — People Playing Volleyball](https://www.pexels.com/video/people-playing-volleyball-6217124/) | 0.3 s |
| 15–18 s | Bắn cung | [Mikhail Nilov — Man Practicing Archery](https://www.pexels.com/video/man-practicing-archery-6603042/) | 2 s |
| 18–21 s | Bơi lội | [Kindel Media — A Man Swimming in the Pool](https://www.pexels.com/video/a-man-swimming-in-the-pool-8686073/) | 0.5 s |
| 21–24 s | Bóng đá | [Tima Miroshnichenko — Soccer Team Training](https://www.pexels.com/video/soccer-team-doing-training-on-the-field-6077690/) | 2.5 s |
| 24–27 s | Quần vợt | [Gelato Prod — Tennis Players Playing Match](https://www.pexels.com/video/tennis-players-playing-match-10378830/) | 3.5 s |

## Regenerate

Install FFmpeg separately, then run `node scripts/build-hero-video.mjs` from the project root.
Use `FFMPEG_PATH` to point to an executable if FFmpeg is not on PATH.
The script downloads source clips into the OS temporary directory and produces the montage and poster.
Cached sources include their clip ID so changing a source cannot reuse an older clip. When replacing the montage, also bump the video URL version in `HomeLandingView.jsx` so browsers load the new file.
