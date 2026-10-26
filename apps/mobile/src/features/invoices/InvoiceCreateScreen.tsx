import {
  completeBillingMatch,
  extractBillingText,
  matchBillingLine,
  resolvePlaceOfSupply,
  type BillingMatchFailure,
} from '@invoice-gst/shared';
import type { Customer } from '@invoice-gst/types';
import {
  useFocusEffect,
  useNavigation,
  type NavigationAction,
} from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Amount } from '../../components/common/Amount';
import { Text } from '../../components/common/AppText';
import { Avatar } from '../../components/common/Avatar';
import { Badge } from '../../components/common/Badge';
import { BottomSheet } from '../../components/common/BottomSheet';
import { Button } from '../../components/common/Button';
import { ChipGroup } from '../../components/common/Chip';
import { Icon } from '../../components/common/Icon';
import { IconButton } from '../../components/common/IconButton';
import { PressableScale } from '../../components/common/PressableScale';
import { Screen } from '../../components/common/Screen';
import { EmptyState, ErrorState } from '../../components/common/States';
import { TextField } from '../../components/common/TextField';
import { useToast } from '../../components/common/Toast';
import { stateLabel } from '../../constants/states';
import { useFocusedQuery } from '../../hooks/useFocusedQuery';
import type { StackNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import {
  discardActiveAndLeave,
  ensureActiveCart,
  flushActiveCart,
  getEditingInvoiceId,
  openCartCount,
  parkActiveAndLeave,
  parkActiveAndStartNew,
  schedulePersistActiveCart,
} from '../../services/cart/cartSession';
import { totalsFromDraft } from '../../services/invoice/draftTotals';
import { useAppDispatch, useAppSelector } from '../../store';
import { invoiceDraftActions, type DraftLine } from '../../store/slices/invoiceDraftSlice';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { formatRupees } from '../../utils/format';
import { haptics } from '../../utils/haptics';
import { waitForModalTeardown } from '../../utils/modalTeardown';
import {
  BILLING_VOICE_LOCALES,
  prepareBillingTranscript,
  translatePackLabel,
  translateSourceLang,
  useBillingVoice,
  type BillingTranslateLang,
  type BillingVoiceLocale,
} from '../voice';
import { CustomerPickerSheet } from './components/CustomerPickerSheet';
import { LeaveDraftSheet } from './components/LeaveDraftSheet';
import { ProductPickerSheet } from './components/ProductPickerSheet';
import { QuantityStepper } from './components/QuantityStepper';
import {
  useVoiceResolveSelection,
  VoiceResolveBody,
  VoiceResolveFooter,
} from './components/VoiceResolveSheet';

export function InvoiceCreateScreen() {
  const navigation = useNavigation<StackNavigation>();
  const { repos } = useDatabase();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const draft = useAppSelector((state) => state.invoiceDraft);
  const styles = useThemedStyles(createStyles);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [billingText, setBillingText] = useState('');
  const [billingError, setBillingError] = useState<string | null>(null);
  const [voiceLocale, setVoiceLocale] = useState<BillingVoiceLocale>('en-IN');
  const [parkedCount, setParkedCount] = useState(0);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [resolveQueue, setResolveQueue] = useState<BillingMatchFailure[]>([]);
  const [lastHeard, setLastHeard] = useState('');
  const allowLeaveRef = useRef(false);
  const pendingLeaveActionRef = useRef<NavigationAction | null>(null);
  const processUtteranceRef = useRef<(text: string, fromVoice: boolean) => void>(() => undefined);
  const voiceLocaleRef = useRef(voiceLocale);
  const missingPackToastRef = useRef<Set<string>>(new Set());

  const resolvePending = resolveQueue[0] ?? null;
  const resolving = resolvePending != null;
  const resolveSelection = useVoiceResolveSelection(resolvePending);

  useEffect(() => {
    voiceLocaleRef.current = voiceLocale;
  }, [voiceLocale]);

  const onVoiceTranscript = useCallback(
    (transcript: string, isFinal: boolean) => {
      setBillingText(transcript);
      setBillingError(null);
      if (!isFinal || !transcript.trim()) {
        return;
      }
      const spoken = transcript.trim();
      setLastHeard(spoken);
      void (async () => {
        const locale = voiceLocaleRef.current;
        const prepared = await prepareBillingTranscript(spoken, locale);
        if (prepared.modelMissing && prepared.sourceLang) {
          const lang = prepared.sourceLang as BillingTranslateLang;
          if (!missingPackToastRef.current.has(lang)) {
            missingPackToastRef.current.add(lang);
            toast.info(
              `Using spoken text until the ${translatePackLabel(lang)} pack is downloaded in Settings.`,
            );
          }
        }
        // Keep the field on what the clerk said; match uses prepared English when ready.
        processUtteranceRef.current(prepared.text, true);
      })();
    },
    [toast],
  );

  const voice = useBillingVoice({
    locale: voiceLocale,
    onTranscript: onVoiceTranscript,
    continuous: true,
    restartEnabled: voiceOpen && !resolving,
  });

  const load = useCallback(
    () =>
      Promise.all([repos.products.listActive(), repos.customers.list(), repos.vendors.get()]),
    [repos],
  );
  const query = useFocusedQuery(load);
  const products = query.data?.[0] ?? [];
  const customers = query.data?.[1] ?? [];
  const vendor = query.data?.[2] ?? null;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        try {
          await ensureActiveCart(repos);
          const [count, editingId] = await Promise.all([
            openCartCount(repos),
            getEditingInvoiceId(repos),
          ]);
          if (active) {
            setParkedCount(count);
            setEditingInvoiceId(editingId);
            setReady(true);
          }
        } catch (error) {
          if (active) {
            toast.error(errorMessage(error));
          }
        }
      })();
      return () => {
        active = false;
        void flushActiveCart(repos);
      };
    }, [repos, toast]),
  );

  useEffect(() => {
    if (!ready || !draft.activeCartId) {
      return;
    }
    schedulePersistActiveCart(repos);
  }, [draft, ready, repos]);

  // Only bills with line items (or unpaid edits) need park/save prompts.
  // Empty ₹0 carts are discarded quietly — nothing to park or save.
  const draftDirty = useMemo(
    () => Boolean(editingInvoiceId) || draft.lines.length > 0,
    [draft.lines.length, editingInvoiceId],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current) {
        return;
      }
      if (!draftDirty) {
        void discardActiveAndLeave(repos).catch(() => undefined);
        return;
      }
      event.preventDefault();
      pendingLeaveActionRef.current = event.data.action;
      setLeaveOpen(true);
    });
    return unsubscribe;
  }, [draftDirty, navigation, repos]);

  const totals = useMemo(() => {
    if (!vendor) {
      return null;
    }
    return totalsFromDraft(draft, vendor, null);
  }, [draft, vendor]);

  const isInterState = vendor
    ? resolvePlaceOfSupply(vendor.stateCode, draft.customerSnapshot.stateCode).isInterState
    : false;

  const quantityByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of draft.lines) {
      if (line.productId) {
        map.set(line.productId, line.quantityMilli);
      }
    }
    return map;
  }, [draft.lines]);

  const fieldError = billingError ?? voice.error?.message ?? null;
  const itemCount = draft.lines.length;
  const loading = query.status === 'loading';

  async function finishLeaveNavigation() {
    const pending = pendingLeaveActionRef.current;
    pendingLeaveActionRef.current = null;
    setLeaveOpen(false);
    await waitForModalTeardown();
    allowLeaveRef.current = true;
    if (pending) {
      navigation.dispatch(pending);
    } else {
      navigation.goBack();
    }
  }

  async function onLeaveSave() {
    if (itemCount === 0) {
      toast.info('Add at least one item before saving.');
      return;
    }
    setLeaveBusy(true);
    try {
      if (voice.listening) {
        voice.stopListening();
      }
      pendingLeaveActionRef.current = null;
      setLeaveOpen(false);
      await flushActiveCart(repos);
      await waitForModalTeardown();
      navigation.navigate('InvoicePreview');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLeaveBusy(false);
    }
  }

  async function onLeavePark() {
    if (itemCount === 0) {
      toast.info('Add items before parking a bill.');
      return;
    }
    setLeaveBusy(true);
    try {
      if (voice.listening) {
        voice.stopListening();
      }
      await parkActiveAndLeave(repos);
      setEditingInvoiceId(null);
      haptics.success();
      toast.success('Bill parked. Find it under Carts.');
      await finishLeaveNavigation();
    } catch (error) {
      toast.error(errorMessage(error));
      setLeaveBusy(false);
    }
  }

  async function onLeaveDiscard() {
    setLeaveBusy(true);
    try {
      if (voice.listening) {
        voice.stopListening();
      }
      const wasEditing = Boolean(editingInvoiceId);
      await discardActiveAndLeave(repos);
      setEditingInvoiceId(null);
      haptics.selection();
      toast.info(
        wasEditing ? 'Edit discarded. The unpaid invoice is unchanged.' : 'Bill discarded',
      );
      await finishLeaveNavigation();
    } catch (error) {
      toast.error(errorMessage(error));
      setLeaveBusy(false);
    }
  }

  function onLeaveCancel() {
    if (leaveBusy) {
      return;
    }
    pendingLeaveActionRef.current = null;
    setLeaveOpen(false);
  }

  const processUtterance = useCallback(
    (text: string, fromVoice: boolean) => {
      const extracted = extractBillingText(text);
      if (extracted.length === 0) {
        if (!fromVoice) {
          setBillingError('Type a product and a quantity. Example: 2 kg rice 100 rupees');
        }
        return;
      }

      const results = extracted.map((line) => matchBillingLine(line, products));
      let added = 0;
      const needsResolve: BillingMatchFailure[] = [];

      for (const result of results) {
        if (result.ok) {
          dispatch(invoiceDraftActions.addBillingLine({ ...result.line, priced: result.priced }));
          added += 1;
          continue;
        }
        // Ambiguous, related STT near-misses, unit, qty, and hard not_found all
        // go through the resolve sheet so the clerk can pick or see "no match".
        needsResolve.push(result);
      }

      voice.clearError();
      setBillingError(null);

      if (needsResolve.length > 0) {
        setResolveQueue((current) => [...current, ...needsResolve]);
      }

      if (added > 0) {
        haptics.light();
        setBillingText('');
        if (fromVoice) {
          toast.success(added === 1 ? 'Added to cart' : `Added ${added} items`);
        }
      } else if (fromVoice && needsResolve.length > 0) {
        setBillingText('');
      }
    },
    [dispatch, products, toast, voice],
  );

  useEffect(() => {
    processUtteranceRef.current = processUtterance;
  }, [processUtterance]);

  useEffect(() => {
    if (!voiceOpen || !voice.supported) {
      return;
    }
    void voice.startListening();
    // Only when the sheet opens — stop is handled on close.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-once
  }, [voiceOpen]);

  function addFromText() {
    processUtterance(billingText, false);
  }

  function onResolveConfirm() {
    const pending = resolveQueue[0];
    const product = resolveSelection.selected;
    if (!pending || !product) {
      return;
    }
    const matched = completeBillingMatch(
      product,
      pending.extracted,
      resolveSelection.quantityMilli,
    );
    if (!matched.ok) {
      toast.error(billingMissMessage(matched));
      return;
    }
    dispatch(invoiceDraftActions.addBillingLine({ ...matched.line, priced: matched.priced }));
    haptics.success();
    toast.success(`${matched.line.productName} added`);
    setResolveQueue((current) => current.slice(1));
    // Learn spoken phrase so the next utterance matches without Product-form aliases.
    // Prefer the raw spoken line (lastHeard) so HI/TA/ML teach native phrases,
    // not only the English extract after translate.
    const spokenForAlias = lastHeard.trim() || pending.productText;
    void repos.products
      .addSpokenAlias(product.id, spokenForAlias)
      .then((added) => {
        if (added) {
          query.reload();
        }
      })
      .catch(() => undefined);
  }

  function onResolveSkip() {
    setResolveQueue((current) => current.slice(1));
  }

  function closeVoiceSheet() {
    if (voice.armed || voice.listening) {
      voice.stopListening();
    }
    setResolveQueue([]);
    setVoiceOpen(false);
  }

  function selectCustomer(customer: Customer) {
    dispatch(
      invoiceDraftActions.setCustomer({
        customerId: customer.id,
        snapshot: {
          name: customer.name,
          phone: customer.phone,
          gstin: customer.gstin,
          stateCode: customer.stateCode,
        },
      }),
    );
  }

  async function onPark() {
    if (editingInvoiceId) {
      toast.info('Finish updating this unpaid invoice before parking another bill.');
      return;
    }
    if (itemCount === 0) {
      toast.info('Add items before parking a bill.');
      return;
    }
    if (voice.listening) {
      voice.stopListening();
    }
    try {
      await parkActiveAndStartNew(repos);
      setParkedCount(await openCartCount(repos));
      haptics.success();
      toast.success('Bill parked. New cart ready.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function onDiscardEdit() {
    try {
      await discardActiveAndLeave(repos);
      setEditingInvoiceId(null);
      toast.info('Edit discarded. The unpaid invoice is unchanged.');
      allowLeaveRef.current = true;
      navigation.goBack();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function onReview() {
    if (voice.listening) {
      voice.stopListening();
    }
    await flushActiveCart(repos);
    navigation.navigate('InvoicePreview');
  }

  return (
    <Screen
      keyboard
      gap={space[4]}
      footer={
        <View style={styles.footerColumn}>
          <View style={styles.fabRow} pointerEvents="box-none">
            <View style={styles.fabCluster}>
              <IconButton
                icon="add"
                accessibilityLabel="Add products"
                variant="filled"
                size={52}
                onPress={() => setAddOpen(true)}
                style={styles.fab}
              />
              <IconButton
                icon={voice.listening ? 'stop-circle' : 'mic-outline'}
                accessibilityLabel={voice.listening ? 'Stop listening' : 'Voice add'}
                variant={voice.listening ? 'filled' : 'tonal'}
                size={52}
                onPress={() => setVoiceOpen(true)}
                style={styles.fab}
              />
            </View>
          </View>
          <View style={styles.footerShell}>
            <View style={styles.footerTotal}>
              <Text variant="caption" tone="secondary">
                {itemCount === 0
                  ? 'Cart total'
                  : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
              </Text>
              <Amount paise={totals?.totalPaise ?? 0} variant="h2" quietPaise />
            </View>
            <Button
              label="Review"
              icon="arrow-forward"
              iconPosition="trailing"
              onPress={() => void onReview()}
              disabled={itemCount === 0}
              style={styles.footerButton}
            />
          </View>
        </View>
      }
    >
      {query.status === 'error' && !query.data ? (
        <ErrorState
          title="Couldn't load your catalogue"
          message={query.error}
          onRetry={query.reload}
        />
      ) : null}

      <View style={styles.hero}>
        <PressableScale
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Bill to ${draft.customerSnapshot.name}`}
          accessibilityHint="Choose walk-in or a saved customer"
          style={styles.customerPress}
          scaleTo={0.985}
        >
          <View style={styles.customerGlow} />
          <View style={styles.customerRow}>
            {draft.customerId ? (
              <Avatar name={draft.customerSnapshot.name} size={52} />
            ) : (
              <Avatar icon="walk-outline" tone="neutral" size={52} />
            )}
            <View style={styles.customerText}>
              <Text variant="label" tone="brand">
                Bill to
              </Text>
              <Text variant="h3" numberOfLines={1}>
                {draft.customerId ? draft.customerSnapshot.name : 'Walk-in'}
              </Text>
              <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
                {draft.customerId
                  ? [draft.customerSnapshot.phone, stateLabel(draft.customerSnapshot.stateCode)]
                      .filter(Boolean)
                      .join(' · ') || 'Saved customer'
                  : 'Tap to choose a customer'}
              </Text>
            </View>
            <View style={styles.customerChevron}>
              <Icon name="chevron-down" size="small" tone="primaryText" />
            </View>
          </View>
        </PressableScale>

        <View style={styles.heroActions}>
          {editingInvoiceId ? (
            <PressableScale
              onPress={() => void onDiscardEdit()}
              accessibilityRole="button"
              accessibilityLabel="Discard edit"
              style={[styles.actionChip, styles.actionChipDanger]}
              scaleTo={0.97}
            >
              <Icon name="close-circle-outline" size="small" tone="error" />
              <Text variant="label" tone="error">
                Discard
              </Text>
            </PressableScale>
          ) : itemCount > 0 ? (
            <PressableScale
              onPress={() => void onPark()}
              accessibilityRole="button"
              accessibilityLabel="Park this bill"
              style={styles.actionChip}
              scaleTo={0.97}
            >
              <Icon name="pause-circle-outline" size="small" tone="primaryText" />
              <Text variant="label" tone="brand">
                Park
              </Text>
            </PressableScale>
          ) : (
            <View style={[styles.actionChip, styles.actionChipDisabled]} accessibilityState={{ disabled: true }}>
              <Icon name="pause-circle-outline" size="small" tone="textTertiary" />
              <Text variant="label" tone="tertiary">
                Park
              </Text>
            </View>
          )}
          <PressableScale
            onPress={() => navigation.navigate('OpenCarts')}
            accessibilityRole="button"
            accessibilityLabel={parkedCount > 0 ? `${parkedCount} parked carts` : 'Open carts'}
            style={styles.actionChip}
            scaleTo={0.97}
          >
            <Icon name="layers-outline" size="small" tone="primaryText" />
            <Text variant="label" tone="brand">
              {parkedCount > 0 ? `Carts · ${parkedCount}` : 'Carts'}
            </Text>
          </PressableScale>
        </View>
      </View>

      {editingInvoiceId || isInterState ? (
        <View style={styles.statusRow}>
          {editingInvoiceId ? (
            <View style={styles.statusChip}>
              <Icon name="create-outline" size="small" tone="info" />
              <Text variant="caption" tone="info" style={styles.statusChipText}>
                Editing unpaid invoice
              </Text>
            </View>
          ) : null}
          {isInterState ? (
            <View style={styles.statusChip}>
              <Icon name="swap-horizontal" size="small" tone="info" />
              <Text variant="caption" tone="info" style={styles.statusChipText}>
                Inter-state · IGST
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.cartHeader}>
        <View style={styles.cartHeaderText}>
          <Text variant="h3">Your cart</Text>
          <Text variant="caption" tone="secondary">
            {itemCount === 0
              ? 'Add products to start this bill'
              : `${itemCount} ${itemCount === 1 ? 'line' : 'lines'} on this bill`}
          </Text>
        </View>
        {itemCount > 0 ? <Badge label={`${itemCount}`} tone="brand" /> : null}
      </View>

      {itemCount > 0 ? (
        <View style={styles.cartList}>
          {draft.lines.map((line, index) => (
            <CartLineRow
              key={line.key}
              line={line}
              lineTotalPaise={totals?.lines[index]?.lineTotalPaise}
              onChange={(quantityMilli) =>
                dispatch(invoiceDraftActions.setLineQuantity({ key: line.key, quantityMilli }))
              }
              onRemove={() => dispatch(invoiceDraftActions.removeLine(line.key))}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyCart}>
          <View style={styles.emptyIcon}>
            <Icon name="basket-outline" size="large" tone="primaryText" />
          </View>
          <Text variant="bodyMedium">Cart is empty</Text>
          <Text variant="bodySmall" tone="secondary" align="center">
            Tap Add to pick products, or use the mic for a quick line.
          </Text>
          <Button
            label="Add products"
            variant="tonal"
            icon="add"
            size="small"
            onPress={() => setAddOpen(true)}
          />
        </View>
      )}

      <CustomerPickerSheet
        visible={pickerOpen}
        customers={customers}
        selectedId={draft.customerId}
        onClose={() => setPickerOpen(false)}
        onSelectWalkIn={() => dispatch(invoiceDraftActions.setWalkIn())}
        onSelectCustomer={selectCustomer}
        onCreateCustomer={() => {
          void (async () => {
            setPickerOpen(false);
            await waitForModalTeardown();
            navigation.navigate('CustomerForm', {});
          })();
        }}
      />

      <ProductPickerSheet
        visible={addOpen}
        products={products}
        quantityByProductId={quantityByProduct}
        loading={loading}
        onClose={() => setAddOpen(false)}
        onSetQuantity={(product, quantityMilli) => {
          dispatch(invoiceDraftActions.setProductQuantity({ product, quantityMilli }));
        }}
        onCreateProduct={() => {
          void (async () => {
            setAddOpen(false);
            await waitForModalTeardown();
            navigation.navigate('ProductForm', {});
          })();
        }}
      />

      <LeaveDraftSheet
        visible={leaveOpen}
        mode={editingInvoiceId ? 'editing' : 'new'}
        hasItems={itemCount > 0}
        loading={leaveBusy}
        onSave={() => void onLeaveSave()}
        onPark={() => void onLeavePark()}
        onDiscard={() => void onLeaveDiscard()}
        onCancel={onLeaveCancel}
      />

      <BottomSheet
        // One Modal host for listen + resolve. Swapping a second Modal on Android
        // Fabric causes addViewAt / "child already has a parent".
        visible={voiceOpen}
        onClose={closeVoiceSheet}
        title={
          resolving && resolveSelection.chrome
            ? resolveSelection.chrome.title
            : 'Add by voice'
        }
        description={
          resolving && resolveSelection.chrome
            ? resolveSelection.chrome.description
            : 'Keep the mic on and speak lines like “2 kg rice”. Matching items add straight to the cart.'
        }
        footer={
          resolving && resolvePending ? (
            <VoiceResolveFooter
              pending={resolvePending}
              selected={resolveSelection.selected}
              quantityMilli={resolveSelection.quantityMilli}
              queueRemaining={Math.max(0, resolveQueue.length - 1)}
              onQuantityChange={resolveSelection.setQuantityMilli}
              onConfirm={onResolveConfirm}
              onSkip={onResolveSkip}
            />
          ) : (
            <View style={styles.voiceFooter}>
              {voice.supported ? (
                <Button
                  label={voice.armed || voice.listening ? 'Stop listening' : 'Start listening'}
                  icon={voice.armed || voice.listening ? 'stop-circle' : 'mic-outline'}
                  variant={voice.armed || voice.listening ? 'dangerSolid' : 'primary'}
                  onPress={() => {
                    void voice.toggleListening();
                  }}
                />
              ) : null}
              <Button
                label="Add typed line"
                icon="add"
                variant="secondary"
                disabled={billingText.trim().length === 0}
                onPress={addFromText}
              />
            </View>
          )
        }
      >
        {/* Keyed host so listen ↔ resolve swaps do not reparent Fabric views. */}
        <View
          key={resolving ? 'voice-resolve' : 'voice-listen'}
          collapsable={false}
          style={styles.voiceBody}
        >
          {resolving && resolvePending ? (
            <VoiceResolveBody
              pending={resolvePending}
              selectedId={resolveSelection.selectedId}
              onSelect={resolveSelection.setSelectedId}
            />
          ) : (
            <>
              {voice.supported ? (
                <>
                  <ChipGroup
                    accessibilityLabel="Speech language"
                    options={BILLING_VOICE_LOCALES}
                    value={voiceLocale}
                    onChange={(next) => {
                      if (voice.armed || voice.listening) {
                        voice.stopListening();
                      }
                      setVoiceLocale(next);
                      voice.clearError();
                    }}
                  />
                  <Text variant="caption" tone="secondary">
                    {BILLING_VOICE_LOCALES.find((row) => row.value === voiceLocale)?.hint ??
                      (translateSourceLang(voiceLocale)
                        ? 'Download the language pack in Settings for better matches.'
                        : 'Malayalam has no on-device translate — picks teach aliases.')}
                  </Text>
                </>
              ) : (
                <Text variant="caption" tone="secondary">
                  Mic needs a development build. You can still type a line.
                </Text>
              )}
              {voice.armed || voice.listening ? (
                <View style={styles.listeningBanner}>
                  <Icon name="radio-button-on" size="small" tone="error" />
                  <Text variant="bodySmall" tone="secondary" style={styles.listeningText}>
                    Listening… say the next item when ready
                  </Text>
                </View>
              ) : null}
              {lastHeard && !(voice.armed || voice.listening) ? (
                <Text variant="caption" tone="tertiary">
                  Last heard: {lastHeard}
                </Text>
              ) : null}
              <TextField
                label="Billing line"
                value={billingText}
                placeholder="2 kg rice 100 rupees"
                error={fieldError}
                returnKeyType="done"
                hint="Voice adds automatically. Type here only if you need to edit a line."
                onChangeText={(value) => {
                  setBillingText(value);
                  if (billingError) {
                    setBillingError(null);
                  }
                  voice.clearError();
                }}
                onSubmitEditing={addFromText}
                trailing={
                  voice.supported ? (
                    <IconButton
                      icon={voice.armed || voice.listening ? 'stop-circle' : 'mic-outline'}
                      accessibilityLabel={
                        voice.armed || voice.listening ? 'Stop listening' : 'Start listening'
                      }
                      variant={voice.armed || voice.listening ? 'filled' : 'tonal'}
                      size={36}
                      onPress={() => {
                        void voice.toggleListening();
                      }}
                    />
                  ) : undefined
                }
              />
            </>
          )}
        </View>
      </BottomSheet>
    </Screen>
  );
}

function billingMissMessage(result: BillingMatchFailure): string {
  if (result.reason === 'ambiguous') {
    return `“${result.productText}” matches more than one product — pick which one.`;
  }
  if (result.reason === 'related') {
    return `No exact match for “${result.productText}” — pick a related product.`;
  }
  if (result.reason === 'unit') {
    return `“${result.productText}” is not sold in that unit — set the shop quantity.`;
  }
  if (result.reason === 'need_quantity') {
    return `How much “${result.productText}” should we add?`;
  }
  return `No product matching “${result.productText}”.`;
}

function CartLineRow({
  line,
  lineTotalPaise,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  lineTotalPaise: number | undefined;
  onChange: (quantityMilli: number) => void;
  onRemove: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.line}>
      <View style={styles.lineTop}>
        <Avatar name={line.productName} shape="square" size={44} />
        <View style={styles.lineHeader}>
          <Text variant="bodyMedium" numberOfLines={2}>
            {line.productName}
          </Text>
          <Text variant="caption" tone="secondary" tabular numberOfLines={1}>
            {formatRupees(line.unitPricePaise)} / {line.unit}
          </Text>
        </View>
        {lineTotalPaise != null ? (
          <Amount paise={lineTotalPaise} variant="h3" />
        ) : null}
      </View>
      <QuantityStepper
        quantityMilli={line.quantityMilli}
        unit={line.unit}
        productName={line.productName}
        onChange={onChange}
        onRemove={onRemove}
      />
    </View>
  );
}

function createStyles({ colors, elevation }: Theme) {
  return StyleSheet.create({
    hero: {
      gap: space[3],
      padding: space[4],
      borderRadius: radius.extraLarge,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
      boxShadow: elevation.low,
    },
    customerPress: {
      borderRadius: radius.large,
      overflow: 'hidden',
    },
    customerGlow: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.primarySoft,
      opacity: 0.55,
    },
    customerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      padding: space[3],
    },
    customerText: {
      flex: 1,
      gap: 2,
    },
    customerChevron: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    heroActions: {
      flexDirection: 'row',
      gap: space[2],
    },
    actionChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space[2],
      minHeight: 44,
      paddingHorizontal: space[3],
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    actionChipDanger: {
      backgroundColor: colors.errorSoft,
    },
    actionChipDisabled: {
      opacity: 0.55,
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space[2],
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      paddingHorizontal: space[3],
      paddingVertical: space[2],
      borderRadius: radius.pill,
      backgroundColor: colors.infoSoft,
    },
    statusChipText: {
      flexShrink: 1,
    },
    cartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space[3],
      paddingHorizontal: space[1],
    },
    cartHeaderText: {
      flex: 1,
      gap: 2,
    },
    cartList: {
      gap: space[3],
    },
    emptyCart: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: space[3],
      paddingVertical: space[10],
      paddingHorizontal: space[5],
      borderRadius: radius.extraLarge,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: radius.extraLarge,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: space[1],
    },
    footerColumn: {
      gap: space[3],
      overflow: 'visible',
    },
    fabRow: {
      alignItems: 'center',
      justifyContent: 'center',
      // Sit centered on StickyFooter’s top border (footer paddingTop is space[3]).
      marginTop: -(space[3] + 34),
      marginBottom: space[1],
      zIndex: 3,
      elevation: 3,
    },
    fabCluster: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space[3],
      paddingHorizontal: space[3],
      paddingVertical: space[2],
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      boxShadow: elevation.medium,
    },
    fab: {
      borderRadius: radius.pill,
    },
    footerShell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
    },
    footerTotal: {
      flex: 1,
      gap: 2,
    },
    footerButton: {
      minWidth: 118,
    },
    line: {
      gap: space[4],
      padding: space[4],
      borderRadius: radius.extraLarge,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    lineTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
    },
    lineHeader: {
      flex: 1,
      gap: 2,
    },
    voiceFooter: {
      gap: space[2],
    },
    voiceBody: {
      gap: space[4],
    },
    listeningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      paddingHorizontal: space[3],
      paddingVertical: space[2],
      borderRadius: radius.medium,
      backgroundColor: colors.errorSoft,
    },
    listeningText: {
      flex: 1,
    },
  });
}
