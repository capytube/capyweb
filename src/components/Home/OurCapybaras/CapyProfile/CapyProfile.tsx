import { StorageImage } from '@aws-amplify/ui-react-storage';
import styles from './CapyProfile.module.css';
import magnusImg from '../../../../assets/magnus.jpg';
import { calculatedAge, capitalizeWords } from '../../../../utils/function';
import { CapybaraAtomType } from '../../../../store/atoms/capybaraAtom';

interface CapyProfileProps {
  data: CapybaraAtomType;
  customCardStyle: { transform: string };
}

const CapyProfile = (props: CapyProfileProps) => {
  const { data, customCardStyle } = props;

  return (
    <div className={styles.card} style={customCardStyle}>
      {data?.card_image_url ? (
        <StorageImage
          alt={data?.name ?? ''}
          path={data?.card_image_url ?? ''}
          fallbackSrc={magnusImg}
          loading="lazy"
          className={styles.image}
        />
      ) : null}
      <div className={styles.content}>
        <h2 className={styles.name}>{data?.name}</h2>
        <p className={styles.age_info}>
          {capitalizeWords(data?.gender ?? '')}, {calculatedAge(data?.birth_date ?? '')}
        </p>
        <p className={styles.location_info}>{data?.born_place}</p>
        {data?.description ? <p className={styles.description}>{data?.description}</p> : null}

        {data?.personality ? (
          <>
            <h3 className={styles.subheading}>Personality:</h3>
            <p className={styles.text}>{data?.personality}</p>
          </>
        ) : null}
        {data?.favorite_activities ? (
          <>
            <h3 className={styles.subheading}>Favorite Activites:</h3>
            <p className={styles.text}>{data?.favorite_activities}</p>
          </>
        ) : null}
        {data?.fun_fact ? (
          <>
            <h3 className={styles.subheading}>Fun Facts:</h3>
            <p className={styles.text}>{data?.fun_fact}</p>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default CapyProfile;
