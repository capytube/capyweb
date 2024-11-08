import styles from "./CapyGallery.module.css";
import gallery1 from "../../../assets/gallery1.jpg";
import gallery2 from "../../../assets/gallery2.jpg";
import gallery3 from "../../../assets/gallery3.jpg";

const CapyGallery = () => {
  return (
    <div className={styles.capyGalleryWrapper}>
      <h1>Capy Gallery</h1>
      <div className={styles.galleryImageContainer}>
        <img src={gallery1} alt="capy" />
        <img src={gallery2} alt="capy" />
        <img src={gallery3} alt="capy" />
      </div>
    </div>
  );
};

export default CapyGallery;
