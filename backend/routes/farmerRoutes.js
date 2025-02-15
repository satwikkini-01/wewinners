const express = require("express");
const router = express.Router();

const {
	handleFarmerSignUp,
	addProduct,
	updateProduct,
	deleteProduct,
	getAllFarmersUsername,
	getApprovedFarmers,
	getNotApprovedFarmers,
	approveFarmer,
	handleFarmerLogin,
    upload,
} = require("../controllers/farmerController");

router.post("/register", handleFarmerSignUp);
router.post("/login", handleFarmerLogin);

// router.get("/profile", getFarmerProfile);
// router.put("/profile", updateFarmerProfile);
router.post("/products", upload.array("images", 6), addProduct);
// router.get("/products", getFarmerProducts);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);
// router.get("/orders", getFarmerOrders);
// router.put("/order/:id/status", updateOrderStatus);
router.get("/allfarmersUsername", getAllFarmersUsername);
router.get("/allfarmers", getApprovedFarmers);
router.get("/pendingFarmers", getNotApprovedFarmers);
router.patch("/approveFarmer", approveFarmer);

router.get("/sales/:farmerId", getFarmerSales);
router.get("/orders/stats/:farmerId", getFarmerOrdersStats);

module.exports = router;
