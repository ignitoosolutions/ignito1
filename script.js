/*
 * Client‑side interactions for the IgnitoSolutions site.
 *
 * This script implements the following functionality:
 *  - A dark/light theme toggle that persists user preference
 *  - A navigation bar that hides when scrolling down and reveals on scroll up
 *  - A simple shopping cart stored in localStorage with add/remove actions
 *  - A quote request modal on the home page
 *  - A service cost calculator on the services page
 *  - A basic front‑end blog post creator (no back end persistence)
 *  - Contact form AJAX submission and Google Maps initialization
 *  - Checkout page summary and PayPal test integration
 */

document.addEventListener('DOMContentLoaded', () => {
  // ===== Theme Toggle =====
  const body = document.body;
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;
  // Apply stored theme if present
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) {
    body.setAttribute('data-theme', storedTheme);
    updateThemeIcon(storedTheme);
  }
  // Toggle handler
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = body.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      body.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateThemeIcon(next);
    });
  }
  function updateThemeIcon(theme) {
    if (!themeIcon) return;
    if (theme === 'light') {
      themeIcon.classList.remove('fa-moon');
      themeIcon.classList.add('fa-sun');
    } else {
      themeIcon.classList.remove('fa-sun');
      themeIcon.classList.add('fa-moon');
    }
  }

  // ===== Navbar Scroll Behaviour =====
  const navbar = document.querySelector('.navbar');
  let lastScrollY = window.pageYOffset;
  window.addEventListener('scroll', () => {
    const currentY = window.pageYOffset;
    if (currentY > lastScrollY && currentY > 50) {
      navbar && navbar.classList.add('nav-hidden');
    } else {
      navbar && navbar.classList.remove('nav-hidden');
    }
    lastScrollY = currentY;
  });

  // ===== Cart Logic (dropdown) =====
  const cartBtn = document.getElementById('cart-button');
  const cartDropdown = document.getElementById('cart-dropdown');
  const cartItemsList = document.getElementById('cart-items');
  const cartTotalEl = document.getElementById('cart-total');
  const cartCountEl = document.querySelector('.cart-count');
  let cart = [];

  try { cart = JSON.parse(localStorage.getItem('cart')) || []; } catch (_) { cart = []; }
  updateCartUI();

  // Toggle dropdown
  if (cartBtn && cartDropdown) {
    cartBtn.addEventListener('click', (e) => {
      const isOpen = cartDropdown.classList.toggle('open');
      cartBtn.setAttribute('aria-expanded', String(isOpen));
      cartDropdown.setAttribute('aria-hidden', String(!isOpen));
      e.stopPropagation();
    });
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!cartDropdown.contains(e.target) && e.target !== cartBtn) {
        cartDropdown.classList.remove('open');
        cartBtn.setAttribute('aria-expanded', 'false');
        cartDropdown.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // Add to cart buttons (data-* on Services cards)
  const addButtons = document.querySelectorAll('[data-id][data-price]');
  addButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const price = parseFloat(btn.getAttribute('data-price'));
      if (id && name && !isNaN(price)) addToCart(id, name, price);
    });
  });

  function saveCart() { localStorage.setItem('cart', JSON.stringify(cart)); }
  function updateCartUI() {
    if (cartCountEl) cartCountEl.textContent = String(cart.reduce((s,i)=>s+i.quantity,0));
    if (cartItemsList) {
      cartItemsList.innerHTML = '';
      let total = 0;
      cart.forEach((item, idx) => {
        total += item.price * item.quantity;
        const li = document.createElement('li');
        li.innerHTML = `
          <span>${item.name} x ${item.quantity}</span>
          <span>$${(item.price*item.quantity).toFixed(2)}</span>
        `;
        // remove button
        const remove = document.createElement('button');
        remove.textContent = 'Remove';
        remove.className = 'btn';
        remove.style.marginLeft = '8px';
        remove.onclick = () => { cart.splice(idx,1); saveCart(); updateCartUI(); };
        li.appendChild(remove);
        cartItemsList.appendChild(li);
      });
      if (cartTotalEl) cartTotalEl.textContent = `$${total.toFixed(2)}`;
    }
  }
  function addToCart(id,name,price){
    const ex = cart.find(i=>i.id===id);
    if (ex) ex.quantity += 1;
    else cart.push({ id, name, price, quantity: 1 });
    saveCart(); updateCartUI();
    // small affordance: briefly open the dropdown
    if (cartDropdown && !cartDropdown.classList.contains('open')) {
      cartDropdown.classList.add('open');
      setTimeout(()=>cartDropdown.classList.remove('open'), 1600);
    }
  }


  // ===== Checkout Page =====
  const checkoutSummary = document.getElementById('checkout-summary');
  const checkoutForm = document.getElementById('checkout-form');
  let checkoutTotal = 0;
  if (checkoutSummary) {
    // Build summary list and compute total
    if (!cart || cart.length === 0) {
      checkoutSummary.innerHTML = '<p>Your cart is empty.</p>';
    } else {
      let html = '<ul class="checkout-items">';
      cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        checkoutTotal += itemTotal;
        html += `<li>${item.name} x ${item.quantity} - $${itemTotal.toFixed(2)}</li>`;
      });
      html += '</ul>';
      html += `<div class="total">Total: $${checkoutTotal.toFixed(2)}</div>`;
      checkoutSummary.innerHTML = html;
      // Render PayPal buttons if script loaded
      if (typeof paypal !== 'undefined') {
        paypal.Buttons({
          style: { shape: 'rect', color: 'gold', layout: 'vertical' },
          createOrder: function(data, actions) {
            return actions.order.create({
              purchase_units: [{ amount: { value: checkoutTotal.toFixed(2) } }]
            });
          },
          onApprove: function(data, actions) {
            return actions.order.capture().then(function(details) {
              alert('Payment completed by ' + details.payer.name.given_name + '!');
            });
          }
        }).render('#paypal-button-container');
      }
    }
    // Form submission to server
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(checkoutForm);
        const orderData = {
          items: cart,
          total: checkoutTotal,
          name: formData.get('name'),
          email: formData.get('email'),
          message: formData.get('message') || ''
        };
        fetch('/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        })
          .then(res => res.json())
          .then(data => {
            if (data.status === 'success') {
              alert('Order placed successfully!');
              localStorage.removeItem('cart');
              window.location.href = '/';
            } else {
              alert(data.message || 'An error occurred while processing your order.');
            }
          })
          .catch(() => {
            alert('An error occurred while processing your order.');
          });
      });
    }
  }

  // ===== Cost Calculator on Services Page =====
  const calcForm = document.getElementById('cost-calculator-form');
  const calcServiceSelect = document.getElementById('calc-service');
  const calcQuantityInput = document.getElementById('calc-quantity');
  const calcResult = document.getElementById('calc-result');
  if (calcForm && calcServiceSelect && calcQuantityInput && calcResult) {
    calcForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const priceVal = parseFloat(calcServiceSelect.value);
      const qty = parseInt(calcQuantityInput.value, 10);
      if (!isNaN(priceVal) && priceVal > 0 && !isNaN(qty) && qty > 0) {
        const estimate = priceVal * qty;
        calcResult.textContent = `Estimated cost: $${estimate.toFixed(2)}`;
      } else {
        calcResult.textContent = 'Please select a valid service and quantity.';
      }
    });
  }

  // ===== Quote Modal on Home Page =====
  const quoteBtn = document.getElementById('quote-btn');
  const quoteModal = document.getElementById('quote-modal');
  const quoteClose = document.getElementById('quote-close');
  const quoteForm = document.getElementById('quote-form');
  if (quoteBtn && quoteModal) {
    // Open modal
    quoteBtn.addEventListener('click', () => {
      quoteModal.style.display = 'flex';
    });
    // Close via X
    if (quoteClose) {
      quoteClose.addEventListener('click', () => {
        quoteModal.style.display = 'none';
      });
    }
    // Close when clicking outside modal content
    window.addEventListener('click', (e) => {
      if (e.target === quoteModal) {
        quoteModal.style.display = 'none';
      }
    });
    // Submit quote via AJAX to contact route
    if (quoteForm) {
      quoteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(quoteForm);
        fetch('/contact', {
          method: 'POST',
          body: formData
        })
          .then(res => res.json())
          .then(json => {
            if (json.status === 'success') {
              alert('Quote request submitted!');
              quoteModal.style.display = 'none';
              quoteForm.reset();
            } else {
              alert(json.message || 'An error occurred while submitting your request.');
            }
          })
          .catch(() => {
            alert('An error occurred while submitting your request.');
          });
      });
    }
  }

  // ===== Blog Page Front‑End =====
  const blogForm = document.getElementById('blog-form');
  const postsContainer = document.getElementById('posts-container');
  if (blogForm && postsContainer) {
    let posts = [];
    blogForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(blogForm);
      const title = formData.get('title');
      const author = formData.get('author');
      const date = formData.get('date') || new Date().toISOString().split('T')[0];
      const content = formData.get('content');
      const file = formData.get('image');
      // Helper to create post after file is read (if provided)
      const finalizePost = (imageURL) => {
        const post = { title, author, date, content, imageURL };
        posts.push(post);
        renderPosts();
        blogForm.reset();
      };
      if (file && file.size > 0) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          finalizePost(evt.target.result);
        };
        reader.readAsDataURL(file);
      } else {
        finalizePost('');
      }
      function renderPosts() {
        if (posts.length === 0) {
          postsContainer.innerHTML = '<p>No posts yet. Use the form below to add new posts.</p>';
        } else {
          postsContainer.innerHTML = '';
          posts.forEach(post => {
            const wrapper = document.createElement('div');
            wrapper.className = 'post';
            let html = `<h4>${post.title}</h4>`;
            html += `<small>By ${post.author} on ${post.date}</small>`;
            if (post.imageURL) {
              html += `<img src="${post.imageURL}" alt="Post image" style="max-width:100%; margin-top:8px;" />`;
            }
            html += `<p>${post.content}</p>`;
            wrapper.innerHTML = html;
            postsContainer.appendChild(wrapper);
          });
        }
      }
    });
  }

  // ===== Contact Form =====
  const contactFormEl = document.getElementById('contact-form');
  if (contactFormEl) {
    contactFormEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(contactFormEl);
      fetch('/contact', {
        method: 'POST',
        body: formData
      })
        .then(res => res.json())
        .then(json => {
          if (json.status === 'success') {
            alert('Message sent! We will get back to you soon.');
            contactFormEl.reset();
          } else {
            alert(json.message || 'An error occurred while sending your message.');
          }
        })
        .catch(() => {
          alert('An error occurred while sending your message.');
        });
    });
  }

  // ===== Google Map Initialization =====
  // Define initMap globally only if it hasn't been defined by Google Maps callback
  if (typeof window.initMap === 'undefined') {
    window.initMap = function() {
      const mapEl = document.getElementById('map');
      if (!mapEl || typeof google === 'undefined') return;
      const center = { lat: 30.0444, lng: 31.2357 }; // Cairo coordinates
      const map = new google.maps.Map(mapEl, {
        zoom: 12,
        center: center
      });
      new google.maps.Marker({ position: center, map: map, title: 'IgnitoSolutions Cairo Office' });
    };
  }
});