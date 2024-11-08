import styles from "./CapyProfile.module.css";
import { CapybaraData } from "../OurCapybaras";

interface CapyProfileProps {
  data: CapybaraData;
  customCardStyle: { transform: string };
}

const CapyProfile = (props: CapyProfileProps) => {
  const { data, customCardStyle } = props;

  return (
    <div className={styles.card} style={customCardStyle}>
      <img src={data?.image} alt={data?.name} className={styles.image} />
      <div className={styles.content}>
        <h2 className={styles.name}>{data?.name}</h2>
        <p className={styles.age_info}>
          {data?.gender}, {data?.dob}
        </p>
        <p className={styles.location_info}>{data?.location}</p>
        {data?.bio ? <p className={styles.description}>{data?.bio}</p> : null}
        {data?.details?.map((item) => {
          return (
            <>
              <h3 className={styles.subheading}>{item?.title}</h3>
              <p className={styles.text}>{item?.description}</p>
            </>
          );
        })}
      </div>
    </div>
  );
};

export default CapyProfile;
