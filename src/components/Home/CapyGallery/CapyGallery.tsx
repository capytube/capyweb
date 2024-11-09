import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

import styles from "./CapyGallery.module.css";
import gallery1 from "../../../assets/gallery1.jpg";
import gallery2 from "../../../assets/gallery2.jpg";
import gallery3 from "../../../assets/gallery3.jpg";

const CapyGallery = () => {
  const images = [gallery1, gallery2, gallery3];

  return (
    <div className={styles.capyGalleryWrapper}>
      <h1>Capy Gallery</h1>
      <Swiper
        spaceBetween={10}
        slidesPerView={3}
        pagination={{ clickable: true }}
        navigation
        style={{ width: "100%", maxWidth: "80%" }}
      >
        {images.map((image, index) => (
          <SwiperSlide key={index}>
            <img
              src={image}
              alt={`Slide ${index + 1}`}
              style={{ width: "100%", borderRadius: "10px" }}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default CapyGallery;
