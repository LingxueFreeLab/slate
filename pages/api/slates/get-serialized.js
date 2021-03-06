import * as Data from "~/node_common/data";
import * as Serializers from "~/node_common/serializers";
import * as Strings from "~/common/strings";

export default async (req, res) => {
  let slate;
  if (req.body.data.id) {
    slate = await Data.getSlateById({ id: req.body.data.id });
  } else if (req.body.data.username && req.body.data.slatename) {
    slate = await Data.getSlateByName({
      username: req.body.data.username,
      slatename: req.body.data.slatename,
    });
  }
  if (!slate || slate.error) {
    return res.status(404).send({
      decorator: "SLATE_NOT_FOUND",
      error: true,
    });
  }
  slate = Serializers.slate(slate);

  let user = await Data.getUserById({ id: slate.data.ownerId });
  if (!user || user.error) {
    return res.status(200).send({
      decorator: "SLATE_OWNER_NOT_FOUND",
      data: slate,
    });
  }
  slate.user = Serializers.user(user);

  return res.status(200).send({
    decorator: "SERIALIZED_SLATE",
    data: slate,
  });
};
