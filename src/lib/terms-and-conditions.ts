// Full text of "My Fit Pod Ts & Cs.pdf" (confirmed identical across all three
// dated copies in the user's Downloads — 28/05/2025, 20/10/2025, 11/08/2026 —
// so there is exactly one version, not several to reconcile). Transcribed
// 2026-08-22 for the help-bot's knowledge base so it can answer general
// Ts & Cs questions beyond the 3-item FAQ.
//
// IMPORTANT: the document's own Clause 9 (Cancellation Policy) states 4hrs
// (Packages/Membership) / 8hrs (PAYG) windows and a £5 membership late fee —
// confirmed with the user 2026-08-22 that this is OUTDATED. The real,
// currently-enforced policy is a 3-hour window with credit forfeiture
// (corrected 2026-08-22 from an earlier 2-hour implementation, per the
// business's real policy on GymFlow) — see the FAQ (DB-backed as of
// 2026-08-26, src/lib/data/help-faq.ts, editable from podHq's
// /chat-questions admin page — was a static src/lib/faq.ts array before
// that) and cancel_booking() (podHq migration 0046, superseding
// 0020/0039's 2-hour version). The legal document itself needs updating
// separately — not done here. help-bot.ts's system prompt explicitly
// tells the model to defer to the FAQ over this document's Clause 9 for
// that reason.
export const TERMS_AND_CONDITIONS = `TERMS AND CONDITIONS

By completing any transaction with My Fit Pod or using a My Fit Pod service in any format, you are agreeing to abide by the Terms & Conditions. In addition to this, you are also agreeing to our other policies that reside in the Terms & Condition but also form their own entity: House Rules, Cancellation Policy, Privacy Policy.

These Terms & Conditions ("Terms") constitute a legally binding agreement between you and My Fit Pod Ltd ("My Fit Pod", "we", "us" or "our"). These Terms govern your access to the use of any My Fit Pod gyms (the "Network"), the My Fit Pod Website and any other websites through which My Fit Pod makes the Network available (the "Website"), and our Mobile Application, other smart device applications and application program interfaces (the "APIs") through which My Fit Pod makes the Network available (the "Mobile Application"). The Website, the Mobile Application and Network are collectively referred to as "My Fit Pod".

1. GENERAL
My Fit Pod Ltd is a company registered in England and Wales. Company registration number 13168737. Registered VAT number 336466191. Questions or complaints: hello@myfitpod.co.uk. Not enforcing a breach, or giving extra time to pay or comply, does not stop My Fit Pod enforcing the Terms strictly at a future date.

We may assign the benefit of these Terms and our rights to a third party on notice to you, without prejudicing your rights. We are not liable for failure or delay caused by events outside our reasonable control. We are not liable for outstanding money paid to a Personal Trainer — My Fit Pod does not arrange or interfere with the Personal Trainer/Client relationship. As a consumer, you retain your legal rights regarding services not carried out with reasonable skill and care, or faulty/misdescribed materials (advice from Citizens' Advice Bureau or Trading Standards) — nothing here affects those rights. My Fit Pod may terminate the agreement immediately on notifying you of a breach. My Fit Pod may change or modify these Terms at any time without notice, effective on posting; continued use after a change means acceptance, and you are responsible for regularly reviewing the current Terms.

2. ELIGIBILITY AND USE OF MY FIT POD
You must be 18 or over and able to enter legally binding contracts to access or register for My Fit Pod. Not available to persons under 18. You warrant you are 18+ and will not allow anyone under 18 into My Fit Pod without prior approval (email hello@myfitpod.co.uk).

Use is for your sole personal use, not commercial purposes; you may not let others use your username/password. You must comply with all applicable local laws while using My Fit Pod. Payments/Packages are processed via Stripe, subject to Stripe's and your issuing bank's own Terms and Privacy Policy in addition to these Terms — My Fit Pod is not responsible for Stripe/bank errors. You agree to comply with any additional Terms from the Landlord and/or Managing Agent ("Property Managers") of the Network, including building security/IT access procedures. Google Maps use is subject to Google's Terms; downloading via the Apple App Store means also agreeing to Apple's Terms.

3. PERSONAL TRAINER SPECIFIC TERMS
Personal trainers must hold a valid Professional Liability Insurance Policy (minimum £2,000,000 general liability coverage) to register a personal trainer Account (email hello@myfitpod.co.uk), kept in force throughout use; My Fit Pod may request a copy of the policy or other info. My Fit Pod is not responsible for personal trainers or their clients regarding injury, illness or lost income from use of the services. Personal Trainers must check equipment before each session and report defects/issues to My Fit Pod.

4. ACCOUNT REGISTRATION
Signing up for an Account requires personal and credit card information, held/processed by Stripe per the Privacy Policy. You must keep Account information accurate and up to date (including a valid card on file) — failure may block access, and My Fit Pod may suspend/terminate an Account it reasonably suspects holds inaccurate, outdated or untrue information. You may not use My Fit Pod illegally or inconsistently with these Terms. You are responsible for all activity under your Account, including other people present during a reservation you made — you indemnify My Fit Pod for any Terms/law violation by such other persons, even if you did not cause it.

5. HOUSE RULES
By transacting with or using My Fit Pod you agree to abide by the House Rules below. My Fit Pod may add or alter House Rules at its sole discretion to prevent a breach of the Terms.

YOU WILL:
1. Invite guests only via the My Fit Pod Mobile Application, so headcount can be tracked.
2. Wear suitable gym clothing and footwear.
3. Sanitise your hands before using equipment, at the sanitiser station provided.
4. Store bags/belongings away from the gym floor, in the storage space or bathroom areas.
5. Leave My Fit Pod clean and tidy — put equipment away, remove trip hazards/litter, wipe down machines, clear spillages, sanitise hands.
6. Take all belongings with you when leaving — neither My Fit Pod, the Landlord nor the Managing Agent is responsible for property left behind.
7. Leave on time and be courteous to users entering after you.
8. Be responsible and charged for damage to equipment beyond normal wear and tear, or necessary cleaning, caused by your violation of the agreement.
9. Be held liable and charged for costs to replace any equipment you take/theft from the facility.
10. Provide proof of identity if reasonably requested by My Fit Pod, the Landlord and/or Managing Agent.
11. Follow any additional rules My Fit Pod, the Landlord and/or Managing Agent sets.

YOU WILL NOT:
1. Allow access of more than 5 people (including yourself) into My Fit Pod at once.
2. Share your access details / Access Device.
3. Provide access to anyone you do not know or have not formally invited via the app.
4. Use the Website, Mobile Application or Network to send or store unlawful material.
5. Use My Fit Pod for unlawful or illegal purposes.
6. Use My Fit Pod for inappropriate purposes — including but not limited to drugs, alcohol, gambling, sexual activity, extreme sports, or anything likely to reflect negatively on My Fit Pod, the Landlord and/or Managing Agent.
7. Smoke inside any My Fit Pod facility, including e-cigarettes.
8. Bring harmful weapons or sharp objects (including firearms and knives) into the facility.
9. Allow any naked flame (lighters, candles, etc.) inside My Fit Pod.
10. Make excessive noise deemed by My Fit Pod, the Landlord and/or Managing Agent to disturb surrounding retail, office or residential premises.
11. Bring animals into the facility, except harnessed and leashed service animals.
12. Allow anyone under 18 into the facility without prior approval (email hello@myfitpod.co.uk).
13. Install, remove or modify any My Fit Pod fixtures, fittings, equipment, hardware or appliances.
14. Use the WiFi or Bluetooth services for unlawful purposes or anti-social behaviour.
15. Tarnish or purposely sabotage the My Fit Pod brand or intellectual property.

ACCESS DETAILS POLICY
Your Access details / Access Device are for your use only, issued solely to you (your account is personal to you); you must keep them secure and confidential. They remain My Fit Pod's property at all times unless otherwise agreed in writing. Use is monitored for safety/security, and users may be asked to prove identity.

If My Fit Pod believes your Access details/Device were used by someone else, it may investigate: informing you by email, asking for reasonable assistance, then sharing findings and proposed action by email. If you unreasonably refuse to cooperate, or the investigation finds reasonable grounds your details were used (with or without your knowledge/consent) by another individual, My Fit Pod may: (a) apply a penalty charge to your card on file equal to the daily rate for each occasion of unauthorised use; and/or (b) in cases of serious/repeated misuse, cancel your Account immediately by email, with no refund. If My Fit Pod has reasonable grounds you knowingly shared your details or allowed unauthorised entry ("tailgating"), it may hold you responsible and liable for the conduct/loss caused by that individual on the premises.

"Access Device" means the device, member card or other security hardware with built-in authentication issued to you. Only one device can be registered per Account at a time; report a lost/misplaced device to hello@myfitpod.co.uk immediately for removal.

6. DAMAGES, REPAIR AND/OR CLEANING FEES
You must leave the Network, property and surrounding area in the same or better condition than you found it, and are responsible for your own acts/omissions and those of anyone you invite or give access to. You are responsible for the cost of damage repairs or necessary cleaning beyond normal wear and tear resulting from your violation of the agreement. My Fit Pod may charge your payment method the reasonable repair/cleaning cost plus an additional service fee up to £500 per occurrence, non-refundable, at My Fit Pod's reasonable discretion.

7. PAYMENT TERMS
Fees are as shown on the Website/Mobile Application at time of purchase, inclusive of VAT. My Fit Pod offers a no-Refund Policy — refunds instead follow the Cancellation Policy (see Clause 9), which applies regardless of your decision to stop using the service. My Fit Pod sets final pricing at its discretion.

You are charged based on booked time length, regardless of actual use; exceeding booked time incurs an excess-time charge, plus an overage charge if it conflicts with another user's booking — you consent to both. Promotional offers apply only if made directly to you. My Fit Pod may change fees at its sole discretion (see also Clause 21, Promotion Terms).

A declined card triggers a request for a valid replacement within 48 hours, or access may be suspended. Declined/refunded/cancelled/charged-back payments do not entitle you to the return of associated service/processing fees, regardless of reason. My Fit Pod may refuse a payment it suspects is fraudulent, without limit. Standard mobile carrier rates apply when accessing via the Mobile Application.

8. MEMBERSHIPS
Membership subscriptions renew monthly on the same date/time as the original purchase, until cancelled by you or My Fit Pod. To change your renewal date, contact hello@myfitpod.co.uk. My Fit Pod may increase Membership prices with at least 1 full month's notice, stating clearly when the increase takes effect and the new cost; you retain the usual right to terminate before the increase takes effect, otherwise the new price applies.

9. CANCELLATION POLICY
[NOTE: this clause as printed in the legal document is confirmed OUTDATED as of 2026-08-22 — do not use these numbers. The actual, currently-enforced policy is a flat 3-hour cancellation window before your session, with the credit/payment forfeited if you cancel within that window or no-show — see FAQ_ITEMS for the correct, current wording to give members. The as-printed document text (4hrs Packages/Membership, 8hrs PAYG, £5 membership late-cancellation fee) is retained here only for completeness/audit and must NOT be quoted to members.]

Cancellations by My Fit Pod: sessions may be cancelled subject to a force majeure or similar event making it impossible or significantly impeding the service.

10. LICENSING, RESTRICTIONS AND COPYRIGHT
My Fit Pod grants you a limited, non-exclusive, non-transferable, revocable licence to use My Fit Pod; downloaded content remains My Fit Pod's property and is for its intended purpose only. You may not copy, adapt, decompile, modify, reverse engineer, distribute, sell, publicly display/perform, transmit, stream, broadcast or otherwise exploit the Website, Mobile Application, Network or content, except as permitted.

11. USER CONTENT
My Fit Pod may permit users to post/upload/submit content ("User Content"), for which you are solely responsible. By making User Content available, you grant My Fit Pod a worldwide, irrevocable, perpetual, non-exclusive, transferable, royalty-free licence to use, copy, adapt, modify, distribute, display, sell and otherwise exploit it, and you waive moral rights in favour of My Fit Pod. You warrant you own or are licensed to grant these rights, and that your User Content does not infringe any third-party rights or law. My Fit Pod may remove User Content it deems inappropriate, abusive, unlawful or in breach of these Terms, with no liability to third parties for it.

12. INTELLECTUAL PROPERTY
"IP" covers copyright, patents, inventions, confidential information, know-how, trade secrets, trademarks, service marks, trade names, design rights, database rights, data rights, domain names and computer software rights, registered or not. Unless indicated otherwise, the Website, Mobile Application and Network and all IP are owned by My Fit Pod and/or its licensors, who reserve all rights. Nothing grants you rights beyond the Website/Mobile Application/Network's intended use; you may not reproduce, copy or distribute any content or design without prior written consent. You retain ownership of any User Data you provide, but grant My Fit Pod a non-exclusive, perpetual, irrevocable, royalty-free, transferable licence to use it per the Privacy Policy. My Fit Pod may remove "Infringing User Data" it deems inappropriate, abusive or unlawful, with no third-party liability.

13. APPLICATION LICENSE
My Fit Pod grants a limited, non-exclusive, non-sublicensable, revocable, non-transferable licence to access/use the Mobile Application on your personal device, and any related content/materials, solely for your personal, non-commercial use. All other rights are reserved by My Fit Pod and its licensors.

14. SMS MESSAGING
You agree My Fit Pod may contact you by phone or text (including automatic dialling systems) at numbers provided in connection with your Account, including for marketing — this is not a condition of purchase, and you may opt out of texts at any time.

15. THIRD-PARTY SERVICES
Correspondence, purchases or promotions with third-party providers/advertisers/sponsors/affiliates encountered through My Fit Pod are solely between you and that third party; My Fit Pod has no liability for them and does not endorse linked sites. Third-party providers may require you to agree to their own additional Terms. My Fit Pod may rely on third-party advertising/marketing to subsidise the service; by agreeing to these Terms you agree to receive it, though you may opt out by emailing hello@myfitpod.co.uk (My Fit Pod may then charge a higher fee). My Fit Pod may compile/release/disclose non-identifiable customer-profile data, including to third-party service providers. You are responsible for taking reasonable precautions with any third party you interact with through My Fit Pod.

16. INDEMNITY
You agree to release, defend, indemnify and hold harmless My Fit Pod, its Landlords/Managing Agents and their officers, directors, agents, subsidiaries, employees and third-party service providers from all claims, losses, liabilities, costs and damages (including legal fees) arising from your use of/access to My Fit Pod, your violation of these Terms or any law/third-party right, or any claim that content you submitted caused third-party damage — notify My Fit Pod in writing (hello@myfitpod.co.uk) of any such claim. This indemnity survives termination of the Terms and your use of My Fit Pod.

17. DISCLAIMER
My Fit Pod is provided "as is"/"where is"/"as available", with all warranties disclaimed to the maximum extent permitted by law (merchantability, fitness for purpose, quality, non-infringement, performance, compatibility, security, accuracy) — the entire risk of use rests with you. The locking mechanism is third-party provided; My Fit Pod, the Landlord and/or Managing Agent have no liability for its failure, including loss/theft of property, since the Network sits in buildings not owned/managed/manned by My Fit Pod. No warranty is given regarding suitability of the Network for any particular activity, uninterrupted/error-free operation, availability, security, or freedom from malfunctions/bugs/hardware failures.

18. WAIVER
By using My Fit Pod's activities/facilities/services, you declare you understand differing skill levels exist and assume full responsibility for your choices and use of equipment/facilities/information/instruction, at your own risk. You acknowledge risk relates to your own state of fitness/health, and agree that to your knowledge you are in good health and not incapable of active/passive exercise in a way detrimental to your health/safety/wellbeing. You should immediately withdraw from or modify involvement in an activity on signs of physical discomfort (lightheadedness, fainting, chest discomfort, leg cramps, nausea, etc). My Fit Pod accepts no responsibility for your actions, injuries or health during use. Where the Mobile Application's Premium features provide exercise technique videos, exercise instructions, or a workout generated or selected by an automated tool ("AI Coach" or similar), this content is provided as general guidance only, is not personalised medical or professional advice, and does not replace the judgement of a qualified professional — you are solely responsible for judging whether any exercise, weight or item of equipment shown or suggested is appropriate for your own ability, fitness and health, and for stopping immediately if it is not. In a life-threatening emergency, call 999 (or local equivalent) immediately and press the facility's Emergency Button to notify My Fit Pod.

19. LIMITATION OF LIABILITY
My Fit Pod, its Officers, Directors, Shareholders, Employees, Suppliers, Sub-Contractors, Agents, Landlords and Managing Agents are not liable for direct, indirect, incidental, consequential or other damage/loss (including profit or data loss) arising from use or inability to use My Fit Pod, including employee error, reliance on service content, Account cancellation, or loss/retention/disclosure of your content. My Fit Pod does not warrant the accuracy, completeness or currency of information accessible via the service. Responsibility for decisions you make using My Fit Pod rests solely with you; My Fit Pod does not assess suitability/legality of building owners or other third parties introduced to you, and you waive/release claims related to them to the maximum extent allowed by law. Building quality is the Landlord's/Managing Agent's responsibility; you use My Fit Pod, including any potentially dangerous/unsafe locations, at your own risk. Nothing here limits liability for death or personal injury caused by My Fit Pod's negligence, or for fraud/fraudulent misrepresentation, where local law applies.

20. FACILITY RATING SYSTEM
You may be prompted to rate aspects of your experience, including other users. Not participating when requested, or receiving a below-threshold rating from My Fit Pod or other users, may result in My Fit Pod restricting your access at its sole discretion.

21. PROMOTION TERMS
My Fit Pod may end any promotion without warning at any time. Prizes must be claimed within 21 days of the winners' announcement; My Fit Pod has 45 days to issue a prize. All challenges are subject to fair play. My Fit Pod may redeem any prize as a voucher or pre-purchased credit instead.

22. NOTICES
My Fit Pod may send notices to the email on your Account. You may send notices, complaints or claims to hello@myfitpod.co.uk — deemed given when received by My Fit Pod.

23. GOVERNING LAW
Governed by the laws of England and Wales; courts of England and Wales have jurisdiction, though Northern Ireland and Scotland residents may also bring proceedings in their own jurisdiction.

24. TERMINATION
My Fit Pod may terminate any Account or your use of My Fit Pod, and remove/discard any part of your Account or User Content, at its sole discretion, at any time, with or without notice, and without liability to you. You may terminate your Account by ceasing all use, deleting the Mobile Application, and no longer using the Network — or by emailing hello@myfitpod.co.uk to request cancellation, subject to contract.

25. GENERAL
No joint venture, partnership, employment or agency relationship is created by these Terms. You may not assign these Terms without My Fit Pod's prior written approval; My Fit Pod may assign them without your consent (e.g. to a parent/subsidiary, asset acquirer, or merger successor). Any unauthorised assignment is void. An invalid/unenforceable provision is struck out without affecting the rest. My Fit Pod not enforcing a right/provision is not a waiver unless acknowledged in writing. These Terms are the entire agreement between you and My Fit Pod, superseding all prior discussions or agreements on the same subject.`;
