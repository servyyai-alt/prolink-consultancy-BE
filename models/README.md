// This file documents all remaining models - each is in its own file in production

/*
=== Blog.js ===
Fields: title, slug, content, excerpt, author(ref:User), category, tags, 
        thumbnail, status(draft/published), views, likes, comments[], 
        metaTitle, metaDescription, publishedAt, isFeatured
*/

/*
=== Service.js ===
Fields: name, slug, description, shortDescription, icon, image, category,
        features[], process[], pricing[{plan,price,features[]}], 
        faqs[{question,answer}], isActive, order, metaTitle, metaDescription
*/

/*
=== Testimonial.js ===
Fields: name, designation, company, avatar, content, rating(1-5),
        service(ref:Service), isApproved, isFeatured, order
*/

/*
=== Payment.js ===
Fields: user(ref:User), orderId, paymentId, signature, amount, currency,
        status(pending/completed/failed/refunded), gateway(razorpay/stripe),
        type(cv_writing/subscription/event_booking/catering),
        referenceId, referenceModel, metadata, refundedAt, refundAmount
*/

/*
=== Notification.js ===
Fields: recipient(ref:User), sender(ref:User), type, title, message,
        data{}, isRead, link, createdAt
*/

/*
=== CvOrder.js ===
Fields: user(ref:User), plan(basic/standard/premium), originalResume{url,public_id},
        deliveredResume{url,public_id}, status(pending/in_progress/delivered/revision),
        instructions, price, payment(ref:Payment), deadline, atsScore,
        revisions[], deliveredAt
*/

/*
=== CampusDrive.js ===
Fields: title, company, logo, description, date, venue, eligibility{},
        branches[], cgpa, skills[], slots, registered[], status,
        results[], isPublished, postedBy(ref:User)
*/

/*
=== Event.js ===
Fields: title, slug, description, category, images[], venue, date,
        packages[{name,price,features[],maxGuests}], gallery[],
        inquiries[], status, postedBy(ref:User), metaTags
*/

/*
=== CateringBooking.js ===
Fields: user(ref:User), name, email, phone, eventType, date, venue,
        guests, menuType, packages[], specialRequests, budget,
        status(pending/confirmed/completed/cancelled), payment(ref:Payment),
        notes, assignedTo(ref:User)
*/

/*
=== ContactInquiry.js ===
Fields: name, email, phone, subject, message, service, status(new/read/replied/closed),
        source, ipAddress, userAgent, repliedBy(ref:User), repliedAt, reply
*/

/*
=== AuditLog.js ===
Fields: user(ref:User), action, resource, resourceId, oldData{}, newData{},
        ipAddress, userAgent, createdAt
*/
