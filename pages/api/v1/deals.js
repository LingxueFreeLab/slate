import * as Utilities from "~/node_common/utilities";
import * as Data from "~/node_common/data";
import * as Strings from "~/common/strings";
import * as Filecoin from "~/common/filecoin";
import * as Powergate from "~/node_common/powergate";

export default async (req, res) => {
  const response = await Data.getAllDeals();

  let totals = {
    size: 0,
    deals: 0,
    cost: 0,
  };

  let slingshot = {
    root: "t3xhj6odc2cjj3z6kmxqugjjai2unacme65gnwigse4xx6jcpmfmi6jg6miqintibacluxi4ydlmolfpruznba",
    total: 0,
    addresses: [],
  };

  response.forEach((each) => {
    totals.deals += 1;
    totals.size += each.data.size;
    totals.cost += each.data.totalCostAttoFIL;

    if (!slingshot.addresses.includes(each.data.addr)) {
      slingshot.total += 1;
      slingshot.addresses.push(each.data.addr);
    }
  });

  totals.costFormatted = Filecoin.formatAsFilecoinConversion(totals.cost);
  totals.sizeFormatted = Strings.bytesToSize(totals.size);
  totals.averages = {
    costPerDealFIL: Filecoin.formatAsFilecoinConversion(totals.cost / totals.deals),
    costPerDealAttoFIL: totals.cost / totals.deals,
    sizePerDealBytes: totals.size / totals.deals,
    sizePerDealBytesFormatted: Strings.bytesToSize(totals.size / totals.deals),
    costPerByteAttoFIL: totals.cost / totals.size,
    costPerByteFIL: Filecoin.formatAsFilecoinConversion(totals.cost / totals.size),
    costPerGBFIL: Filecoin.formatAsFilecoinConversion((totals.cost / totals.size) * 1073741824),
  };

  if (!response) {
    return res.status(500).send({
      decorator: "V1_GET_ALL_DEALS_ERROR",
      error: true,
    });
  }

  if (response.error) {
    return res.status(500).send({
      decorator: "V1_GET_ALL_DEALS_ERROR",
      error: true,
    });
  }

  return res
    .status(200)
    .send(
      JSON.stringify({ decorator: "V1_GET_ALL_DEALS", totals, slingshot, deals: response }, null, 4)
    );
};
