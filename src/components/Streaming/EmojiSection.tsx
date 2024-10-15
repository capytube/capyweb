import React from "react";
import { type WriteContractReturnType, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import { CapyCoin, CapyTip } from "../../utils";
import { config } from "../../Web3Provider"
interface EmojiSectionProps {
  streamId: string;
  emojis: string[];
  emojiCounts: { [emoji: string]: number };
  onEmojiClick: (streamId: string, emoji: string) => void;
}

const EmojiSection: React.FC<EmojiSectionProps> = ({
  streamId,
  emojis,
  emojiCounts,
  onEmojiClick,
}) => {
  const tipStream = async () => {
    const AddAllowance: WriteContractReturnType = await writeContract(config, {
      abi: CapyCoin.abi,
      address: CapyCoin.address as `0x${string}`,
      functionName: "approve",
      args: [CapyTip.address, 100000000000]
    })
    const transactionRecipt = waitForTransactionReceipt(config, {
      hash: AddAllowance
    })
    await transactionRecipt

    writeContract(config, {
      abi: CapyTip.abi,
      address: CapyTip.address as `0x${string}`,
      functionName: "Tip",
      args: [100000000000, "TEST COMMONET"]
    })

  }








  return (
    <div style={styles.emojiContainer}>
      {emojis.map((emoji, index) => (
        <button
          key={index}
          style={styles.emojiButton}
          onClick={async () => {
            onEmojiClick(streamId, emoji)
            await tipStream()


          }}
        >
          {emoji} {emojiCounts[emoji] || 0}
        </button>
      ))}
    </div>
  );
};

const styles = {
  emojiContainer: {
    display: "flex",
    gap: "10px",
    marginBottom: "10px",
  },
  emojiButton: {
    background: "none",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
  },
};

export default EmojiSection;
