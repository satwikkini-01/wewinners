const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Cart = require("../models/Cart");
const Subscription = require("../models/Subscription");

const handleUserSignUp = async (req, res) => {
	try {
		const { firstName, lastName, email, password, phNumber } = req.body;

		const existingUser = await User.findOne({ $or: [{ email }] });
		if (existingUser) {
			return res
				.status(400)
				.json({ message: "Email, Username already exists" });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const newUser = await User.create({
			firstName,
			lastName,
			email,
			password: hashedPassword,
			phNumber,
		});

		return res
			.status(201)
			.json({ message: "user registered successfully", user: newUser });
	} catch (error) {
		console.error("Error in user signup:", error);
		return res.status(500).json({ message: "Internal Server Error" });
	}
};

const handleuserLogin = async (req, res) => {
	try {
		const { email, password } = req.body;
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(401).json({ message: "Invalid email or password" });
		} else {
			const isPasswordValid = await bcrypt.compare(password, user.password);
			if (!isPasswordValid) {
				return res.status(401).json({ message: "Invalid email or password" });
			} else {
				const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
					expiresIn: "1d",
				});
				return res.status(200).json({ message: "Login successful", token });
			}
		}
	} catch (error) {
		console.error("Error in user login:", error);
		return res.status(500).json({ message: "Internal Server Error" });
	}
};

const getAllProducts = async (req, res) => {
	try {
		const products = await Product.find({ stock: { $gt: 0 } }).sort({
			soldCount: -1,
		});
		res.status(200).json(products);
	} catch (err) {
		res.status(500).json({ message: "Error fetching products", error: err });
	}
};

const getAllProductsFarmer = async (req, res) => {
  try {
    const { username } = req.params; // Get username from request params
    console.log(username)

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    // Find products belonging to the farmer with stock > 0
    const products = await Product.find({ farmerId: username, stock: { $gt: 0 } })
      .sort({ soldCount: -1 });

    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ message: "Error fetching products", error: err });
  }
};


const getProductById = async (req, res) => {
	try {
		const product = await Product.findById(req.params.productId);
		if (!product) return res.status(404).json({ message: "Product not found" });
		res.status(200).json(product);
	} catch (err) {
		res
			.status(500)
			.json({ message: "Error fetching product details", error: err });
	}
};

const getUserProfile = async (req, res) => {
	try {
		const user = await User.findById(req.user.id).select("-password");
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}
		const subscription = await Subscription.findOne({
			userId: user._id,
			status: "active",
		});
		res.status(200).json({ user, subscription });
	} catch (error) {
		res.status(500).json({ message: "Error fetching user profile", error });
	}
};

const updateUserProfile = async (req, res) => {
	try {
		const { name, email, phone, address } = req.body;

		const updatedUser = await User.findByIdAndUpdate(
			req.user.id,
			{ name, email, phone, address },
			{ new: true, runValidators: true }
		);

		if (!updatedUser) {
			return res.status(404).json({ message: "User not found" });
		}

		res
			.status(200)
			.json({ message: "Profile updated successfully", updatedUser });
	} catch (error) {
		console.error("Error updating profile:", error);
		res.status(500).json({ message: "Error updating profile", error });
	}
};

const addUserOrders = async (req, res) => {
	try {
		const { items, address } = req.body;

		if (!items || items.length === 0) {
			return res.status(400).json({ message: "No products selected" });
		}

		// Extract product IDs
		const productIds = items.map((item) => item.product);

		// Fetch all products in a single query
		const products = await Product.find({ _id: { $in: productIds } });

		if (products.length !== items.length) {
			return res.status(404).json({ message: "Some products not found" });
		}

		let totalPrice = 0;
		const updatedProducts = [];

		for (let item of items) {
			const product = products.find((p) => p._id.toString() === item.product);
			if (!product) continue;

			// Check if enough stock is available
			if (product.stock < item.quantity) {
				return res.status(400).json({
					message: `Not enough stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
				});
			}

			// Calculate total price
			totalPrice += product.price * item.quantity;

			// Reduce stock and prepare update queries
			product.stock -= item.quantity;
			product.soldCount += item.quantity;
			updatedProducts.push(product.save());
		}

		// Update all products in parallel
		await Promise.all(updatedProducts);

		// Create new order
		const newOrder = await Order.create({
			customer: req.user.id,
			items,
			totalPrice,
			address,
			status: "Pending",
		});

		res.status(201).json({
			message: "Order placed successfully",
			order: {
				_id: newOrder._id,
				items: newOrder.items,
				totalPrice: newOrder.totalPrice,
				status: newOrder.status,
			},
		});
	} catch (error) {
		console.error("Error creating order:", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
};

const getUserOrders = async (req, res) => {
	try {
		const orders = await Order.find({ customer: req.user.id })
			.populate("items.product", "name price") // Populate product details
			.sort({ createdAt: -1 });

		if (!orders.length) {
			return res.status(404).json({ message: "No orders found" });
		}

		res.status(200).json(
			orders.map((order) => ({
				_id: order._id,
				items: order.items.map((item) => ({
					product: item.product._id,
					name: item.product.name,
					price: item.product.price,
					quantity: item.quantity,
				})),
				totalPrice: order.totalPrice,
				address: order.address, // Ensuring the address from Order model is included
				status: order.status,
				createdAt: order.createdAt,
			}))
		);
	} catch (error) {
		console.error("Error fetching orders:", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
};

async function addToCart(req, res) {
	try {
		const { productId, quantity } = req.body;
		const userId = req.user.id;

		// Check if product exists
		const product = await Product.findById(productId);
		if (!product) return res.status(404).json({ message: "Product not found" });

		// Find user's cart or create a new one
		let cart = await Cart.findOne({ user: userId });

		if (!cart) {
			cart = new Cart({ user: userId, items: [] });
		}

		// Check if product is already in cart
		const itemIndex = cart.items.findIndex(
			(item) => item.product.toString() === productId
		);

		if (itemIndex > -1) {
			// Update quantity if product exists
			cart.items[itemIndex].quantity += quantity;
		} else {
			// Add new product to cart
			cart.items.push({ product: productId, quantity });
		}

		await cart.save();
		res.status(200).json({ message: "Product added to cart", cart });
	} catch (error) {
		console.error("Error adding to cart:", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
}

async function getCartItems(req, res) {
	try {
		const userId = req.user.id;
		const cart = await Cart.findOne({ user: userId }).populate(
			"items.product",
			"name price images"
		);

		if (!cart || cart.items.length === 0) {
			return res.status(200).json({ message: "Cart is empty", items: [] });
		}

		res.status(200).json(cart.items);
	} catch (error) {
		console.error("Error fetching cart items:", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
}

async function removeFromCart(req, res) {
	try {
		const userId = req.user.id;
		const { productId } = req.params;

		let cart = await Cart.findOne({ user: userId });
		if (!cart) return res.status(404).json({ message: "Cart not found" });

		// Remove item from cart
		cart.items = cart.items.filter(
			(item) => item.product.toString() !== productId
		);

		await cart.save();
		res.status(200).json({ message: "Item removed from cart", cart });
	} catch (error) {
		console.error("Error removing cart item:", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
}

const addReview = async (req, res) => {
	try {
		const { productId } = req.params;
		const { rating, comment } = req.body;
		const userId = req.user.id; // Extracted from JWT via verifyToken middleware
		const image = req.file ? `/uploads/reviews/${req.file.filename}` : null; // Store image path if uploaded

		// Validate rating
		if (!rating || rating < 1 || rating > 5) {
			return res.status(400).json({ message: "Rating must be between 1 and 5." });
		}

		// Check if product exists
		const product = await Product.findById(productId);
		if (!product) {
			return res.status(404).json({ message: "Product not found." });
		}

		// Check if user already reviewed
		const existingReview = await Review.findOne({ product: productId, user: userId });
		if (existingReview) {
			return res.status(400).json({ message: "You have already reviewed this product." });
		}

		// Create review
		const newReview = new Review({
			product: productId,
			user: userId,
			rating,
			comment,
			image,
		});

		// Save review to database
		await newReview.save();

		res.status(201).json({ message: "Review added successfully.", review: newReview });
	} catch (error) {
		res.status(500).json({ message: "Server error.", error: error.message });
	}
};

// Get all reviews for a specific product
const getProductReviews = async (req, res) => {
	try {
		const { productId } = req.params;

		// Find all reviews for the product, populate user details
		const reviews = await Review.find({ product: productId }).populate("user", "name email");

		// Check if product has reviews
		if (!reviews.length) {
			return res.status(404).json({ message: "No reviews found for this product." });
		}

		res.status(200).json(reviews);
	} catch (error) {
		res.status(500).json({ message: "Server error.", error: error.message });
	}
};

module.exports = {
	getAllProducts,
	getProductById,
	handleUserSignUp,
	handleuserLogin,
	getUserProfile,
	updateUserProfile,
	addUserOrders,
	getUserOrders,
	addToCart,
	getCartItems,
	removeFromCart,
	getProductReviews,
	addReview,
};
