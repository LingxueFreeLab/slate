import * as Environment from "~/node_common/environment";
import * as Utilities from "~/node_common/utilities";
import * as Data from "~/node_common/data";
import * as Constants from "~/node_common/constants";
import * as Serializers from "~/node_common/serializers";
import * as Social from "~/node_common/social";
import * as Strings from "~/common/strings";
import * as Websocket from "~/node_common/nodejs-websocket";
import * as Filecoin from "~/common/filecoin";

const STAGING_DEAL_BUCKET = "stage-deal";

const delay = async (waitMs) => {
  return await new Promise((resolve) => setTimeout(resolve, waitMs));
};

const websocketSend = async (type, data) => {
  if (Strings.isEmpty(Environment.PUBSUB_SECRET)) {
    return;
  }

  let ws = Websocket.get();
  if (!ws) {
    ws = Websocket.create();
    await delay(2000);
  }

  const encryptedData = await Utilities.encryptWithSecret(
    JSON.stringify(data),
    Environment.PUBSUB_SECRET
  );

  // NOTE(jim): Only allow this to be passed around encrypted.
  ws.send(
    JSON.stringify({
      type,
      iv: encryptedData.iv,
      data: encryptedData.hex,
    })
  );
};

export const hydratePartialViewer = async (user) => {
  const data = {
    id: user.id,
    username: user.username,
    data: {
      name: user.data.name ? user.data.name : "",
      photo: user.data.photo ? user.data.photo : "",
      body: user.data.body ? user.data.body : "",
    },
    type: "PARTIAL_VIEWER",
    library: user.data.library,
    onboarding: user.data.onboarding || {},

    // TODO(jim): Move this elsewhere.
    allow_filecoin_directory_listing: user.data.allow_filecoin_directory_listing
      ? user.data.allow_filecoin_directory_listing
      : null,
    allow_automatic_data_storage: user.data.allow_automatic_data_storage
      ? user.data.allow_automatic_data_storage
      : null,
    allow_encrypted_data_storage: user.data.allow_encrypted_data_storage
      ? user.data.allow_encrypted_data_storage
      : null,
  };

  websocketSend("UPDATE", data);
};

export const hydratePartialStatus = async (status, userId) => {
  console.log("HYDRATE partial status");
  const data = {
    id: userId,
    status,
  };
  websocketSend("UPDATE", data);
};

export const hydratePartialSubscriptions = async (updated, userId) => {
  console.log("HYDRATE partial subscriptions");
  const data = {
    id: userId,
  };

  const user = await Data.getUserById({ id: userId });
  if (!user) {
    return null;
  }

  if (user.error) {
    return null;
  }

  let mostRecent;
  if (updated.subscriptions) {
    const subscriptions = await Data.getSubscriptionsByUserId({ userId });
    let r1 = await Serializers.doSubscriptions({
      users: [],
      slates: [],
      subscriptions,
      serializedUsersMap: { [user.id]: Serializers.user(user) },
      serializedSlatesMap: {},
    });
    data.subscriptions = r1.serializedSubscriptions;
    mostRecent = r1;
  }

  if (updated.subscribers) {
    const subscribers = await Data.getSubscribersByUserId({ userId });
    let r2 = await Serializers.doSubscribers({
      users: [],
      slates: [],
      subscribers,
      serializedUsersMap: mostRecent
        ? mostRecent.serializedUsersMap
        : { [user.id]: Serializers.user(user) },
      serializedSlatesMap: mostRecent ? mostRecent.serializedSlatesMap : {},
    });
    data.subscribers = r2.serializedSubscribers;
    mostRecent = r2;
  }

  // if (updated.trusted) {
  //   const trusted = await Data.getTrustedRelationshipsByUserId({ userId });
  //   let r3 = await Serializers.doTrusted({
  //     users: [],
  //     trusted,
  //     serializedUsersMap: mostRecent
  //       ? mostRecent.serializedUsersMap
  //       : { [user.id]: Serializers.user(user) },
  //     serializedSlatesMap: mostRecent ? mostRecent.serializedSlatesMap : {},
  //   });
  //   data.trusted = r3.serializedTrusted;
  //   mostRecent = r3;
  // }

  // if (updated.pendingTrusted) {
  //   const pendingTrusted = await Data.getPendingTrustedRelationshipsByUserId({
  //     userId,
  //   });
  //   let r4 = await Serializers.doPendingTrusted({
  //     users: [userId],
  //     pendingTrusted,
  //     serializedUsersMap: mostRecent
  //       ? mostRecent.serializedUsersMap
  //       : { [user.id]: Serializers.user(user) },
  //     serializedSlatesMap: mostRecent ? mostRecent.serializedSlatesMap : {},
  //   });
  //   data.pendingTrusted = r4.serializedPendingTrusted;
  // }

  websocketSend("UPDATE", data);
};

export const hydratePartialKeys = async (keys, userId) => {
  console.log("HYDRATE partial keys");
  const data = {
    id: userId,
    keys,
  };

  websocketSend("UPDATE", data);
};

export const hydratePartialLibrary = async (library, userId) => {
  console.log("HYDRATE partial library");
  const data = {
    id: userId,
    library,
  };

  websocketSend("UPDATE", data);
};

export const hydratePartialSlates = async (slates, userId) => {
  console.log("HYDRATE partial slates");
  const data = {
    id: userId,
    slates,
  };

  websocketSend("UPDATE", data);
};

// export const hydratePartialActivity = async (activity, userId) => {
//   this one will need to be more complex like what is in hydrate subscriptions
//   websocketSend("UPDATE", data);
// };

export const hydrate = async (id) => {
  let data = getById({ id });
  websocketSend("UPDATE", data);
};

//NOTE(martina): determines whether user is logged in and should be redirected to in-client view
export const shouldRedirect = async ({ id }) => {
  if (Strings.isEmpty(id)) {
    return false;
  }

  const user = await Data.getUserById({
    id,
  });
  if (user && user.id) {
    return true;
  }

  return false;
};

// TODO(jim): Work on better serialization when adoption starts occuring.
export const getById = async ({ id }) => {
  const user = await Data.getUserById({
    id,
  });

  if (!user) {
    return null;
  }

  if (user.error) {
    return null;
  }

  // TODO(jim): You can serialize this last because you will have all the information
  // from subscriptionsed, trusted, and pendingTrusted most likely.
  let activity = await Data.getActivityForUserId({ userId: id });
  const slates = await Data.getSlatesByUserId({ userId: id });
  const keys = await Data.getAPIKeysByUserId({ userId: id });
  const subscriptions = await Data.getSubscriptionsByUserId({ userId: id });
  const subscribers = await Data.getSubscribersByUserId({ userId: id });

  let serializedUsersMap = { [user.id]: Serializers.user(user) };
  let serializedSlatesMap = {};

  // NOTE(jim): The most expensive call first.
  const r1 = await Serializers.doSubscriptions({
    users: [],
    slates: [],
    subscriptions,
    serializedUsersMap,
    serializedSlatesMap,
  });

  const r2 = await Serializers.doSubscribers({
    users: [],
    slates: [],
    subscribers,
    serializedUsersMap: r1.serializedUsersMap,
    serializedSlatesMap: r1.serializedSlatesMap,
  });

  // // NOTE(jim): If any trusted users are subscription users, this ends up being cheaper.
  // const trusted = await Data.getTrustedRelationshipsByUserId({ userId: id });
  // const r3 = await Serializers.doTrusted({
  //   users: [],
  //   trusted,
  //   serializedUsersMap: r2.serializedUsersMap,
  //   serializedSlatesMap: r2.serializedSlatesMap,
  // });

  // // NOTE(jim): This should be the cheapest call.
  // const pendingTrusted = await Data.getPendingTrustedRelationshipsByUserId({
  //   userId: id,
  // });
  // const r4 = await Serializers.doPendingTrusted({
  //   users: [id],
  //   pendingTrusted,
  //   serializedUsersMap: r3.serializedUsersMap,
  //   serializedSlatesMap: r3.serializedSlatesMap,
  // });

  let bytes = 0;
  let imageBytes = 0;
  let videoBytes = 0;
  let audioBytes = 0;
  let epubBytes = 0;
  let pdfBytes = 0;
  user.data.library[0].children.forEach((each) => {
    if (each.type && each.type.startsWith("image/")) {
      imageBytes += each.size;
    } else if (each.type && each.type.startsWith("video/")) {
      videoBytes += each.size;
    } else if (each.type && each.type.startsWith("audio/")) {
      audioBytes += each.size;
    } else if (each.type && each.type.startsWith("application/epub")) {
      epubBytes += each.size;
    } else if (each.type && each.type.startsWith("application/pdf")) {
      pdfBytes += each.size;
    }
    if (each.coverImage) {
      imageBytes += each.coverImage.size;
    }
    bytes += each.size;
  });

  activity = await formatActivity(activity);

  return {
    ...Serializers.user(user),
    type: "VIEWER",
    library: user.data.library,
    onboarding: user.data.onboarding || {},
    status: user.data.status || {},

    // TODO(jim): Move this elsewhere.
    allow_filecoin_directory_listing: user.data.allow_filecoin_directory_listing
      ? user.data.allow_filecoin_directory_listing
      : null,
    allow_automatic_data_storage: user.data.allow_automatic_data_storage
      ? user.data.allow_automatic_data_storage
      : null,
    allow_encrypted_data_storage: user.data.allow_encrypted_data_storage
      ? user.data.allow_encrypted_data_storage
      : null,

    // NOTE(jim): Remaining data.
    stats: {
      bytes,
      maximumBytes: Constants.TEXTILE_ACCOUNT_BYTE_LIMIT,
      imageBytes,
      videoBytes,
      audioBytes,
      epubBytes,
      pdfBytes,
    },
    keys,
    activity,
    slates,
    subscriptions: r1.serializedSubscriptions,
    subscribers: r2.serializedSubscribers,
    // trusted: r3.serializedTrusted,
    // pendingTrusted: r4.serializedPendingTrusted,
  };
};

const formatActivity = async (userActivity) => {
  let activity = userActivity;
  let slateIds = [];
  if (activity && activity.length) {
    activity = activity.filter((item) => {
      if (item.data.type === "SUBSCRIBED_CREATE_SLATE") {
        slateIds.push(item.data.context.slate.id);
      }
      return (
        item.data.type === "SUBSCRIBED_CREATE_SLATE" || item.data.type === "SUBSCRIBED_ADD_TO_SLATE"
      );
    });
  }
  let slates = [];
  if (slateIds && slateIds.length) {
    slates = await Data.getSlatesByIds({ ids: slateIds });
  }
  let slateTable = {};
  for (let slate of slates) {
    slateTable[slate.id] = slate;
  }

  for (let item of activity) {
    if (item.data.type === "SUBSCRIBED_CREATE_SLATE") {
      let slate = slateTable[item.data.context.slate.id];
      if (slate?.data?.objects?.length) {
        item.data.context.slate = slate;
      }
    }
  }
  //NOTE(martina): remove empty slates
  activity = activity.filter((item) => {
    if (item.data.type === "SUBSCRIBED_ADD_TO_SLATE") return true;
    let slate = item.data.context.slate;
    return slate?.data?.objects?.length;
  });
  //NOTE(martina): rearrange order to always get an even row of 6 squares
  let counter = 0;
  for (let i = 0; i < activity.length; i++) {
    let item = activity[i];
    if (item.data.type === "SUBSCRIBED_CREATE_SLATE") {
      counter += 2;
    } else if (item.data.type === "SUBSCRIBED_ADD_TO_SLATE") {
      counter += 1;
    }
    if (counter === 6) {
      counter = 0;
    } else if (counter > 6) {
      let j = i - 1;
      while (activity[j].data.type !== "SUBSCRIBED_ADD_TO_SLATE") {
        j -= 1;
      }
      let temp = activity[j];
      activity[j] = activity[i];
      activity[i] = temp;
      counter = 0;
      i -= 1;
    }
  }
  return activity;
};

export const getDealHistory = async ({ id }) => {
  const user = await Data.getUserById({
    id,
  });

  if (!user) {
    return null;
  }

  if (user.error) {
    return null;
  }

  let deals = [];

  try {
    const FilecoinSingleton = await Utilities.getFilecoinAPIFromUserToken({
      user,
    });
    const { filecoin } = FilecoinSingleton;

    const records = await filecoin.storageDealRecords({
      ascending: false,
      includePending: true,
      includeFinal: true,
    });

    for (let i = 0; i < records.length; i++) {
      const o = records[i];

      deals.push({
        dealId: o.dealInfo.dealId,
        rootCid: o.rootCid,
        proposalCid: o.dealInfo.proposalCid,
        pieceCid: o.dealInfo.pieceCid,
        addr: o.address,
        miner: o.dealInfo.miner,
        size: o.dealInfo.size,
        // NOTE(jim): formatted size.
        formattedSize: Strings.bytesToSize(o.dealInfo.size),
        pricePerEpoch: o.dealInfo.pricePerEpoch,
        startEpoch: o.dealInfo.startEpoch,
        // NOTE(jim): just for point of reference on the total cost.
        totalSpeculatedCost: Filecoin.formatAsFilecoinConversion(
          o.dealInfo.pricePerEpoch * o.dealInfo.duration
        ),
        duration: o.dealInfo.duration,
        formattedDuration: Strings.getDaysFromEpoch(o.dealInfo.duration),
        activationEpoch: o.dealInfo.activationEpoch,
        time: o.time,
        createdAt: Strings.toDateSinceEpoch(o.time),
        pending: o.pending,
        user: Serializers.user(user),
      });
    }
  } catch (e) {
    console.log(e);
    Social.sendTextileSlackMessage({
      file: "/node_common/managers/viewer.js",
      user,
      message: e.message,
      code: e.code,
      functionName: `filecoin.storageDealRecords`,
    });
  }

  return { type: "VIEWER_FILECOIN_DEALS", deals };
};

export const getTextileById = async ({ id }) => {
  const user = await Data.getUserById({
    id,
  });

  if (!user) {
    return null;
  }

  if (user.error) {
    return null;
  }

  // NOTE(jim): This bucket is purely for staging data for other deals.
  const stagingData = await Utilities.getBucketAPIFromUserToken({
    user,
    bucketName: STAGING_DEAL_BUCKET,
    encrypted: false,
  });

  const FilecoinSingleton = await Utilities.getFilecoinAPIFromUserToken({
    user,
  });
  const { filecoin } = FilecoinSingleton;

  let r = null;
  try {
    r = await stagingData.buckets.list();
  } catch (e) {
    Social.sendTextileSlackMessage({
      file: "/node_common/managers/viewer.js",
      user,
      message: e.message,
      code: e.code,
      functionName: `buckets.list`,
    });
  }

  let addresses = null;
  try {
    addresses = await filecoin.addresses();
  } catch (e) {
    Social.sendTextileSlackMessage({
      file: "/node_common/managers/viewer.js",
      user,
      message: e.message,
      code: e.code,
      functionName: `filecoin.addresses`,
    });
  }

  let address = null;
  if (addresses && addresses.length) {
    address = {
      name: addresses[0].name,
      address: addresses[0].address,
      type: addresses[0].type,
      // TODO(jim): Serialize BigInt
      // balance: addresses[0].balance,
    };
  }

  let items = null;
  const dealBucket = r.find((bucket) => bucket.name === STAGING_DEAL_BUCKET);
  try {
    const path = await stagingData.buckets.listPath(dealBucket.key, "/");
    items = path.item.items;
  } catch (e) {
    Social.sendTextileSlackMessage({
      file: "/node_common/managers/viewer.js",
      user,
      message: e.message,
      code: e.code,
      functionName: `buckets.listPath`,
    });
  }

  const b = await Utilities.getBucketAPIFromUserToken({
    user,
    bucketName: "data",
    encrypted: false,
  });

  const settings = await b.buckets.defaultArchiveConfig(b.bucketKey);

  return {
    type: "VIEWER_FILECOIN",
    settings: {
      ...settings,
      addr: addresses[0].address,
      renewEnabled: settings.renew.enabled,
      renewThreshold: settings.renew.threshold,
    },
    address,
    deal: items ? items.filter((f) => f.name !== ".textileseed") : [],
  };
};
