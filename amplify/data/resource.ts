import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { getStream } from '../functions/getStream/resource';
import { getViewership } from '../functions/getViewership/resource';

const schema = a.schema({
  Options: a.customType({
    key: a.string(),
    value: a.string(),
  }),
  Vote_Options: a.customType({
    id: a.string(),
    title: a.string(),
    description: a.string(),
  }),
  Offers: a.customType({
    from: a.string(), // User ID making the offer
    price: a.float(), // Offer price
    expires_at: a.timestamp(), // Expiration date of the offer
  }),
  ActivityLog: a.customType({
    event: a.string(), // Type of event (e.g., "Sale", "Transfer")
    price: a.float(), // Price associated with the event
    from: a.string(), // User ID of the seller or previous owner
    to: a.string(), // User ID of the buyer or new owner
    timestamp: a.timestamp(), // Time of the event
  }),

  getStream: a
    .query()
    .arguments({
      streamId: a.string(),
    })
    .returns(a.string())
    .handler(a.handler.function(getStream))
    .authorization((allow) => [allow.publicApiKey()]),
  getViewership: a
    .query()
    .arguments({
      streamId: a.string(),
    })
    .returns(a.json())
    .handler(a.handler.function(getViewership))
    .authorization((allow) => [allow.publicApiKey()]),

  // login user schema
  UserOld: a
    .model({
      name: a.string(),
      createdAt: a.timestamp(),
      todayEarnedCoins: a.customType({
        coins: a.integer(),
        timeStamp: a.timestamp(),
      }),
      totalEarnedCoins: a.integer(),
      comment: a.hasMany('Comment', 'userId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // comments schema
  Comment: a
    .model({
      streamId: a.id(),
      userId: a.id(),
      user: a.belongsTo('UserOld', 'userId'),
      content: a.string(),
      createdAt: a.timestamp(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // ratings for streams
  Ratings: a
    .model({
      id: a.id(),
      ratingCounts: a.customType({
        capylove: a.integer(),
        capylike: a.integer(),
        capywow: a.integer(),
        capyangry: a.integer(),
        capyfire: a.integer(),
      }),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // capybara list and cams schema
  CapyList: a
    .model({
      id: a.id(),
      capyName: a.string(),
      capyDescription: a.string(),
      availableCameras: a.customType({
        mainCam: a.string(),
        foodCam: a.string(),
        bedroomCam: a.string(),
      }),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // Interactions Table
  Interactions: a
    .model({
      id: a.id(),
      capybara_id: a.id(), // Foreign Key to Capybara
      capybara: a.belongsTo('Capybara', 'capybara_id'),
      interaction_type: a.enum(['vote', 'bid']), // "vote" or "bid"
      title: a.string(), // Title of the interaction (e.g., "Vote for Snack Choice")
      description: a.string(),
      image_url: a.string(),
      options: a.ref('Vote_Options').array(),
      rules: a.string().array(),
      session_date: a.timestamp(),
      result: a.string(), // winning option ID
      vote_cost: a.float(),
      current_bid: a.float(),
      createdAt: a.timestamp(),
      userVotes: a.hasMany('UserVotes', 'interaction_id'),
      userBids: a.hasMany('UserBids', 'interaction_id'),
    })
    .secondaryIndexes((index) => [index('capybara_id').name('CapybaraInteractionIndex').sortKeys(['interaction_type'])])
    .authorization((allow) => [allow.publicApiKey()]),

  // UserVotes schema
  UserVotes: a
    .model({
      id: a.id(),
      interaction_id: a.id(), // Foreign Key to the Interactions Table
      interaction: a.belongsTo('Interactions', 'interaction_id'),
      user_id: a.id(), // Foreign Key to User
      user: a.belongsTo('User', 'user_id'),
      option_id: a.id(), // ID of the option the user voted for
      number_of_votes: a.integer(), // Number of votes purchased
      cost: a.float(), // Total cost (including extra cost for custom votes)
      is_custom_request: a.boolean(), // Whether the vote is for a custom option
      custom_request: a.string(), // custom request string
      approved: a.boolean(), // Whether the custom request is approved (if applicable)
      createdAt: a.timestamp(),
      tokenTransaction: a.hasOne('TokenTransaction', 'related_id'),
    })
    .secondaryIndexes((index) => [index('interaction_id').name('InteractionTypeIndex')])
    .authorization((allow) => [allow.publicApiKey()]),

  // UserBids schema
  UserBids: a
    .model({
      id: a.id(),
      interaction_id: a.id(), // Foreign Key to the Interactions Table
      interaction: a.belongsTo('Interactions', 'interaction_id'),
      user_id: a.id(), // Foreign Key to User
      user: a.belongsTo('User', 'user_id'),
      bid_amount: a.float(),
      createdAt: a.timestamp(),
      tokenTransaction: a.hasOne('TokenTransaction', 'related_id'),
    })
    .secondaryIndexes((index) => [index('interaction_id').name('InteractionTypeIndex')])
    .authorization((allow) => [allow.publicApiKey()]),

  // TokenTransaction schema
  TokenTransaction: a
    .model({
      id: a.id(),
      user_id: a.id(), // Foreign Key to User
      user: a.belongsTo('User', 'user_id'),
      transaction_type: a.enum(['tip', 'reward', 'stream_payment', 'transfer', 'withdraw', 'deposit', 'vote', 'bid']),
      amount: a.float(), // Transaction amount in tokens
      related_id: a.id(), // Can reference UserVotes or UserBids
      related_type: a.enum(['vote', 'bid']),
      relatedVote: a.belongsTo('UserVotes', 'related_id'),
      relatedBid: a.belongsTo('UserBids', 'related_id'),
      createdAt: a.timestamp(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // ChatComments schema
  ChatComments: a
    .model({
      id: a.id(),
      stream_id: a.id(), // Foreign Key to LiveStream
      stream: a.belongsTo('LiveStream', 'stream_id'),
      user_id: a.id(), // Foreign Key to User
      user: a.belongsTo('User', 'user_id'),
      content: a.string(),
      createdAt: a.timestamp(),
    })
    .secondaryIndexes((index) => [index('stream_id').name('StreamCommentsIndex').sortKeys(['createdAt'])])
    .authorization((allow) => [allow.publicApiKey()]),

  // LiveStream schema
  LiveStream: a
    .model({
      id: a.id(),
      title: a.string(),
      start_time: a.timestamp(),
      end_time: a.timestamp(),
      is_live: a.boolean(),
      viewer_count: a.integer(),
      capybara_id: a.string(), // Capybara IDs involved in the stream
      access_type: a.enum(['public', 'private']),
      price_per_10_sec: a.float(),
      streaming_address: a.string(), // URL or address for the live stream
      chatComments: a.hasMany('ChatComments', 'stream_id'),
    })
    .secondaryIndexes((index) => [
      index('access_type').name('AccessTypeIndex'),
      index('capybara_id').name('CapybaraIdIndex'),
    ])
    .authorization((allow) => [allow.publicApiKey()]),

  // Capybara schema
  Capybara: a
    .model({
      id: a.id(),
      name: a.string(),
      gender: a.string(),
      age: a.integer(),
      born_place: a.string(),
      description: a.string(),
      bio: a.string(),
      personality: a.string(),
      card_image_url: a.string(),
      avatar_image_url: a.string(),
      profile_image_url: a.string(),
      favorite_activities: a.string().array(),
      fun_fact: a.string(),
      interactions: a.hasMany('Interactions', 'capybara_id'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // User schema
  User: a
    .model({
      id: a.id(),
      username: a.string(),
      email: a.string(),
      password_hash: a.string(),
      createdAt: a.timestamp(),
      profile_image_url: a.string(),
      wallet_address: a.string(),
      bio: a.string(),
      balance: a.float(),
      userVotes: a.hasMany('UserVotes', 'user_id'),
      userBids: a.hasMany('UserBids', 'user_id'),
      tokenTransaction: a.hasMany('TokenTransaction', 'user_id'),
      chatComments: a.hasMany('ChatComments', 'user_id'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // NFT schema
  NFT: a
    .model({
      id: a.id(), // Unique Token ID (e.g., "NFT1234")
      name: a.string(), // Name of the NFT (e.g., "Capy #1234")
      image_url: a.string(),
      rarity: a.string(), // Rarity level (e.g., "Ultra rare", "Rare")
      labels: a.string().array(), // Labels for categorization (e.g., "Capybara", "Chalk Bonus")
      properties: a.ref('Options').array(), // List of properties (e.g., "Chalk powder bonus")
      price: a.float(), // Current price of the NFT
      is_for_sale: a.boolean(),
      owner_id: a.string(), // User ID of the current owner (nullable if listed for sale)
      createdAt: a.timestamp(),
      offers: a.ref('Offers').array(),
      activity_log: a.ref('ActivityLog').array(), // List of activities (e.g., sales, transfers)
    })
    .secondaryIndexes((index) => [
      index('price').name('ForSaleIndex').sortKeys(['createdAt']),
      index('owner_id').name('OwnerIndex'),
    ])
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    // API Key is used for a.allow.public() rules
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
