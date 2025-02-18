import { useState } from 'react';
import { StorageImage } from '@aws-amplify/ui-react-storage';
import { Loader } from '@aws-amplify/ui-react';
import styles from './CapyProfile.module.css';
import { calculatedAge, capitalizeWords } from '../../../../utils/function';
import { CapybaraAtomType } from '../../../../store/atoms/capybaraAtom';

interface CapyProfileProps {
  data: CapybaraAtomType;
  customCardStyle: { transform: string };
}

const CapyProfile = (props: CapyProfileProps) => {
  const { data, customCardStyle } = props;
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);

  return (
    <div className={styles.card} style={customCardStyle}>
      <div className="relative md:min-w-[210px]">
        {/* Loading Spinner */}
        {isImageLoading && (
          <div className="absolute w-full h-full rounded-3xl flex justify-center items-center">
            <Loader width="3rem" height="3rem" filledColor="#7a3f3e" />
          </div>
        )}
        {/* Actual Image */}
        {data?.card_image_url ? (
          <StorageImage
            alt=""
            path={data?.card_image_url ?? ''}
            loading="lazy"
            className={styles.image}
            onLoad={() => setIsImageLoading(false)}
          />
        ) : null}
      </div>
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
