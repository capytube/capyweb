import styles from './DemoSiteRibbon.module.css';

interface Props {
  clsx?: string;
}

const DemoSiteRibbon = ({ clsx }: Props) => {
  return <div className={`${styles.demoSiteRibbon} ${clsx ?? ''}`}>Beta</div>;
};

export default DemoSiteRibbon; 