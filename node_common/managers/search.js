// TODO(jim): The claim is that we can remove this
// and the package.json depdencies at some later time.
import { grpc } from "@improbable-eng/grpc-web";
import { WebsocketTransport } from "@textile/grpc-transport";
grpc.setDefaultTransport(WebsocketTransport());

import * as Environment from "~/node_common/environment";
import * as Utilities from "~/node_common/utilities";
import * as Data from "~/node_common/data";
import * as Constants from "~/node_common/constants";
import * as Serializers from "~/node_common/serializers";
import * as Strings from "~/common/strings";
import * as Websocket from "~/node_common/nodejs-websocket";

Websocket.create();

const websocketSend = async (type, data) => {
  if (Strings.isEmpty(Environment.PUBSUB_SECRET)) {
    return;
  }

  const ws = Websocket.get();
  if (!ws) {
    console.log("NO WEBSOCKET!");
    return;
  }
  console.log("WEBSOCKET EXISTS");
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
  console.log("websocket sent");
};

export const updateUser = async (user, action) => {
  if (!user || !action) return;
  console.log("UPDATE USER");
  const data = {
    data: { type: action, data: { ...Serializers.user(user), type: "USER" } },
    id: "LENS",
  };
  websocketSend("UPDATE", data);
};

export const updateSlate = async (slate, action) => {
  if (!slate || !action) return;
  console.log("UPDATE SLATE");
  const data = {
    id: "LENS",
    data: { type: action, data: { ...Serializers.slate(slate), type: "SLATE" } },
  };
  websocketSend("UPDATE", data);
};

// export const searchUpdateFile = async (file, userId) => {
//   const data = {
//     id: "LENS",
//     data: { type: action, data: { ...user, type: "FILE" } },
//   };
//   websocketSend("UPDATE", data);
// };
